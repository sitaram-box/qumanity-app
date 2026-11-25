/**
 * Typed calls to the website API. Response shapes mirror Qumanity_DPG
 * (app.py, board_core.py, social_core.py, wallet_core.py, qoin_core.py).
 */

import { api, upload } from './client';

// ---------- shared shapes ----------
export type BoardLevel = 'village' | 'tehsil' | 'district' | 'state' | 'zone' | 'country' | 'continent' | 'earth';
export const PUBLIC_LEVELS: BoardLevel[] = ['village', 'tehsil', 'district', 'state', 'zone'];
export const GLOBAL_LEVELS: BoardLevel[] = ['country', 'continent', 'earth'];

export interface PlaceNode {
  id: string;
  name: string;
  [k: string]: unknown;
}
export type LocationStruct = Partial<Record<'continent' | 'country' | 'zone' | 'state' | 'district' | 'tehsil' | 'village', PlaceNode>>;

export interface Language {
  kind?: 'mother' | 'english' | 'daily';
  name: string;
  code: string;
  native: string;
}

export interface Me {
  name: string;
  gender: 'male' | 'female' | 'both';
  age_years: number;
  age_category: string;
  email: string | null;
  phone: string | null;
  mother_tongue: string;
  daily_language: string;
  languages: Language[];
  sun_sign: string | null;
  sun_element: string | null;
  moon_sign: string | null;
  moon_nakshatra: string | null;
  ascendant_sign: string | null;
  kundali_summary: string | null;
  birth_location: string;
  present_location: string;
  present_location_struct: LocationStruct;
  birth_location_struct?: LocationStruct;
  /** Which of the member's own (up to 3) languages the UI should use -- set on website or app. */
  preferred_language?: string | null;
  middle_name?: string;
  /** "/api/users/<id>/profile-picture" or null (website 2026-10-26); updated_at busts the image cache. */
  profile_picture_url?: string | null;
  profile_picture_updated_at?: string;
  is_admin: boolean;
  /** Server-derived from present_location_struct.country.id -- never decided client-side (website
   * 2026-11-08, account_access_type()). true when the member's Present Location's country is
   * outside the 10 Public Account Activation countries; hides the Public tab/timeline. */
  is_global_account: boolean;
}

// ---------- auth ----------
export const login = (privateId: string, pin: string) =>
  api<{ token: string }>('/login', { body: { private_id: privateId, pin, client: 'app' } });

export interface RegisterBody {
  name: string;
  gender: 'male' | 'female' | 'both';
  dob: string;
  /** HH:MM. Omitted when tob_unknown is true (the server then discards any tob and stores 12:00). */
  tob?: string;
  /** "I don't remember my exact birth time" (website 2026-11): users.birth_time_known = 0. */
  tob_unknown?: boolean;
  /** Optional, private: one of the 8 RELIGION_BELIEF_VALUES; omitted = not answered. Locked once saved. */
  religion_belief?: string;
  pin: string;
  language: string;
  email?: string;
  phone?: string;
  birth_location: LocationStruct;
  present_location: LocationStruct;
  /** Registering someone else: the helper's own Private ID + PIN make them the referrer. */
  assisted?: boolean;
  helper_private_id?: string;
  helper_pin?: string;
  /** Optional, feeds the family naming logic (website 2026-10-20). */
  middle_name?: string;
  /** 12-digit Public ID of whoever referred them; blank/unknown is ignored, and an assisted
   * registration's helper always wins over it (website 2026-10-25). */
  referred_by_public_id?: string;
}
export interface RegisterResult {
  private_code: string;
  /** null when a helper registered someone else — nobody is signed in. */
  token: string | null;
  assisted?: boolean;
  /* donation / donation_error were removed: never sent since payments were removed (2026-10-11). */
  zodiac: { sun_sign: string; sun_element: string; moon_sign: string; ascendant_sign: string };
}
export const register = (b: RegisterBody) =>
  api<RegisterResult>('/api/auth/register', { body: { ...b, client: 'app' }, timeoutMs: 60_000 });

export const ping = () => api<{ sign?: string }>('/api/zodiac/current', { timeoutMs: 6_000 });
export const me = () => api<Me>('/api/me');
export const revealPrivateId = (pin: string) => api<{ private_code: string }>('/api/user/private-code', { body: { pin } });
export const changePin = (current_pin: string, new_pin: string) =>
  api<{ token: string }>('/api/user/pin', { body: { current_pin, new_pin, client: 'app' } });
export const requestPinReset = (private_id: string, channel: 'phone' | 'email') =>
  api<{ status: string; masked_target: string; dev_code?: string }>('/api/auth/forgot-pin/request', { body: { private_id, channel } });
export const verifyPinReset = (private_id: string, otp: string, new_pin: string) =>
  api<{ status: string }>('/api/auth/forgot-pin/verify', { body: { private_id, otp, new_pin } });
export const recoverId = (body: Record<string, string>) =>
  api<{ status: string; reference: string }>('/api/auth/recover-id', { body });

// ---------- Recover Private ID, self-service paths (website app.py, 2026-11-25) ----------
// Additive to recoverId() above (the mail-a-letter path, unchanged) -- two instant, self-service
// paths the website's own /recover-id gained the same day: Name+DOB+Birth Country+PIN (the same
// secret that already gates normal login), and a nuclear family member's phone+OTP for someone
// who has forgotten both their ID and PIN. Both reveal private_id_9digit directly from the live
// `users` row -- never recomputed (id_generator.generate_dob_id() is a one-shot minting function
// with a live, mutating counter, not a decode function).
export const recoverIdByPin = (name: string, dob: string, country_id: string, pin: string) =>
  api<{ private_id_9digit: string }>('/api/auth/recover-id-by-pin', { body: { name, dob, country_id, pin } });
export const recoverIdByFamilyOtp = (name: string, dob: string, country_id: string, family_phone: string) =>
  api<{ status: string; masked_target: string; dev_code?: string }>('/api/auth/recover-id-by-family-otp', { body: { name, dob, country_id, family_phone } });
/** Re-sends all four original fields, not just `otp` -- this is a public, sessionless,
 * multi-user endpoint, so a code alone can't say which pending request it belongs to. */
export const verifyFamilyOtp = (name: string, dob: string, country_id: string, family_phone: string, otp: string) =>
  api<{ private_id_9digit: string }>('/api/auth/verify-family-otp', { body: { name, dob, country_id, family_phone, otp } });

// ---------- Family recovery (website family_recovery_core, 2026-11-13..15) ----------
// The locked-out member asks a nuclear family member (parent / child / sibling / spouse) who is
// on Qumanity to vouch for them. Public routes (no sign-in); every failed check returns the SAME
// generic message on purpose, and attempts are rate-limited (3 per day per network and per
// family member). The website replies with a tracking code: the requester's ONLY key to check the
// status, see their Private ID once shared, or set a new PIN once approved.
export type RecoveryAction = 'private_id' | 'pin_reset' | 'both';
export interface FamilyRecoveryRequest {
  family_member_private_id: string;
  family_member_name: string;
  requester_name: string;
  /** Who the family member is TO the requester: "father" = they are your father. */
  relationship: string;
  action: RecoveryAction;
  /** Optional: when only the PIN is forgotten and the requester still knows their Private ID. */
  requester_private_id?: string;
}
export const familyRecoveryRequest = (body: FamilyRecoveryRequest) =>
  api<{ tracking_code: string; expires_at: string }>('/api/recovery/family/request', { body });
export type RecoveryStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'completed' | 'superseded';
export interface FamilyRecoveryStatus {
  status: RecoveryStatus;
  action: RecoveryAction;
  expires_at: string;
  private_id_available?: boolean;
  pin_reset_ready?: boolean;
}
/** The website's route takes the code as a query parameter (GET); sent over HTTPS only. */
export const familyRecoveryStatus = (tracking_code: string) =>
  api<FamilyRecoveryStatus>(`/api/recovery/family/status?tracking_code=${encodeURIComponent(tracking_code)}`);
export const familyRecoveryRevealPrivateId = (tracking_code: string) =>
  api<{ private_id: string }>('/api/recovery/family/reveal-private-id', { body: { tracking_code } });
export const familyRecoveryCompletePinReset = (tracking_code: string, new_pin: string) =>
  api<{ status: string }>('/api/recovery/family/complete-pin-reset', { body: { tracking_code, new_pin } });

// The family member's side (signed in). Requests arrive as system messages in their Qmail inbox
// (message_type 'family_recovery_request'); the app reads them from there and acts on them.
export interface QmailInboxMessage {
  id: number;
  subject: string;
  created_at: string;
  read_at: string | null;
  message_type: string;
  recovery_request_id: number | null;
}
export const qmailInbox = () => api<{ messages: QmailInboxMessage[] }>('/api/qmail/inbox');
export interface FamilyRecoveryDetail {
  id: number;
  requester_claimed_name: string;
  /** What YOU are to the requester ("parent" = you are their parent). */
  verified_relationship: 'parent' | 'child' | 'sibling' | 'spouse';
  action: RecoveryAction;
  status: RecoveryStatus;
  created_at: string;
  expires_at: string;
  can_act: boolean;
}
export const familyRecoveryDetail = (id: number) => api<FamilyRecoveryDetail>(`/api/qmail/family-recovery/${id}`);
export const familyRecoveryShareId = (id: number) => api<{ status: string }>(`/api/qmail/family-recovery/${id}/share-private-id`, { body: {} });
export const familyRecoveryApprovePin = (id: number) => api<{ status: string }>(`/api/qmail/family-recovery/${id}/approve-pin-reset`, { body: {} });
export const familyRecoveryReject = (id: number) => api<{ status: string }>(`/api/qmail/family-recovery/${id}/reject`, { body: {} });

// ---------- registration helpers ----------
export const zodiacPreview = (dob: string) =>
  api<{ sign: string; element: string; age_name: string; age_range: string }>(`/api/zodiac/preview?dob=${encodeURIComponent(dob)}`);

// ---------- collective board ----------
export interface BoardPost {
  id: number;
  author: string;
  author_id?: number;
  author_gender?: Gender | null;
  author_profile_picture_url?: string | null;
  mine: boolean;
  content: string;
  status: 'active' | 'frozen' | 'elevated' | 'removed';
  score: number;
  my_vote: -1 | 0 | 1 | null;
  created_at: string;
  voting_end: string;
  threshold: number;
  window_days: number;
  origin: { level: string; score: number } | null;
  elevated_to: string | null;
  comments: { who: string; text: string; at: string; user_id?: number; gender?: Gender | null; profile_picture_url?: string | null }[];
  can_vote: boolean;
  can_comment: boolean;
}
export interface Board {
  level: BoardLevel;
  label: string;
  group: string;
  can_post: boolean;
  can_pay_post: boolean;
  post_price: number | null; // in local currency, not raw Qoins — always show with post_price_qoins + currency_symbol
  post_price_qoins: number[] | null;
  currency: string | null;
  currency_symbol: string | null;
  currency_name: string | null;
  threshold: number;
  window_days: number;
  next: string | null;
  posts: BoardPost[];
}
export const board = (level: BoardLevel) => api<Board>(`/api/board/${level}`);
export const createPost = (level: BoardLevel, content: string) => api<{ id: number }>('/api/board/post', { body: { level, content } });
export const vote = (post_id: number, value: -1 | 0 | 1) => api<{ score: number }>('/api/board/vote', { body: { post_id, value } });
export const comment = (post_id: number, text: string) => api<{ status: string }>('/api/board/comment', { body: { post_id, text } });
export const removedPosts = () =>
  api<{ posts: { id: number; level: string; group: string; content: string; score: number; at: string }[] }>('/api/board/removed');

// ---------- Q-Punch council ----------
export interface QPunch {
  group: string;
  /** This level's location id (e.g. "CS.DL.3.4") — the location_id the election routes take. */
  group_id?: string;
  label: string;
  level: BoardLevel;
  residents: number;
  election_min: number;
  election_open: boolean;
  cycle: { kind: string; sign?: string; element?: string; lead?: string };
  seats: { seat: number; title: string; text: string; filled: boolean; name?: string | null }[];
  agents: number;
  can_volunteer: boolean;
  is_volunteer: boolean;
  is_admin: boolean;
  /** The monthly 4-week sign election -- only on the pilot village's page (Rohini Sector 24). */
  election?: ElectionSummary | null;
  guide?: ElectionGuide | null;
}
export const qpunch = (level: BoardLevel) => api<QPunch>(`/api/qpunch/${level}`);
export const volunteer = (skill: string) => api<{ status: string }>('/api/qpunch/volunteer', { body: { skill } });

// ---------- Q-Punch cascade election, Tehsil and up (website election_core.cascade_status, 2026-11-16) ----------
// The Lower House (members currently serving on the councils one level down) elects an 8-seat
// council: 1 Male + 1 Female per element. The elements take turns leading, one per quarter; the
// Upper House (everyone living at this location) approves the leading Male as official Head by 51%,
// and can call a People's Vote on any question. The village keeps its own monthly sign election.
export type Element = 'Fire' | 'Earth' | 'Air' | 'Water';
export type CouncilSeat = { user_id: number; name: string; karma: number } | null;
export interface CascadeStatus {
  level: BoardLevel;
  location_id: string;
  cycle: {
    status: string; // 'nomination' | 'voting' | 'closed' …
    year: number;
    term_years: number | null;
    nomination_start: string;
    nomination_end: string;
    voting_start: string;
    voting_end: string;
  };
  eligibility: {
    can_nominate: boolean;
    nominate_reason: string;
    already_nominated: boolean;
    can_vote: boolean;
    vote_reason: string;
    /** Seats this member already voted for (one vote per seat). */
    voted: { gender: 'male' | 'female'; element: Element }[];
  };
  lower_house_size: number;
  council: {
    id: number;
    term_start: string;
    term_end: string;
    active_element: Element | null;
    head_user_id: number | null;
    head_gender: 'male' | 'female' | null;
    members: Record<Element, { male: CouncilSeat; female: CouncilSeat }>;
    is_upper_house: boolean;
    /** Open 51% Head approval for the leading element's Male, if one is being decided now. */
    approval: { male_candidate_user_id: number; approval_end: string; already_voted: boolean } | null;
  } | null;
}
export interface CascadeCandidate {
  id: number;
  user_id: number;
  name: string;
  gender: 'male' | 'female';
  element: Element;
  manifest: string | null;
  form_reason: string | null;
  form_changes: string | null;
  karma: number;
}
export type CascadeCandidates = Record<Element, { male: CascadeCandidate[]; female: CascadeCandidate[] }>;
const loc = (level: BoardLevel, locationId: string) => `level=${level}&location_id=${encodeURIComponent(locationId)}`;
export const cascadeStatus = (level: BoardLevel, locationId: string) => api<CascadeStatus>(`/api/election/status?${loc(level, locationId)}`);
export const cascadeCandidates = (level: BoardLevel, locationId: string) =>
  api<{ restricted: boolean } & CascadeCandidates>(`/api/election/candidates?${loc(level, locationId)}`);
/** One seat at a time: the website records one vote per (element, gender). */
export const cascadeVote = (level: BoardLevel, location_id: string, element: Element, gender: 'male' | 'female', candidate_user_id: number) =>
  api<{ status: string }>('/api/election/vote', { body: { level, location_id, element, gender, candidate_user_id } });
export const cascadeNominate = (level: BoardLevel, location_id: string, f: { reason: string; why_vote: string; changes: string }) =>
  api<{ status: string }>('/api/election/nominate', { body: { level, location_id, ...f } });
/** Upper House 51% ballot on the leading element's Male becoming official Head. */
export const headApprovalVote = (council_id: number, approve: boolean) => api<{ status: string }>('/api/election/vote', { body: { council_id, approve } });

// People's Vote: a referendum the Upper House can hold at any level (village included).
export interface PeopleVote {
  id: number;
  title: string;
  description: string | null;
  status: 'open' | 'passed' | 'failed';
  end_time: string;
  /** Hidden (null) while the vote is open. */
  votes_for: number | null;
  votes_against: number | null;
  already_voted: boolean;
}
export const peopleVoteStatus = (level: BoardLevel, locationId: string) =>
  api<{ vote: PeopleVote | null; is_upper_house: boolean }>(`/api/people-vote/status?${loc(level, locationId)}`);
export const peopleVoteCast = (vote_id: number, in_favour: boolean) => api<{ status: string }>('/api/people-vote/cast', { body: { vote_id, in_favour } });

// ---------- monthly sign election (election_core.py): week 1 stand, weeks 2-3 vote, week 4 results ----------
export interface ElectionWeek { week: 1 | 2 | 3 | 4; key: string; title: string; start: string; end: string; text: string }
export interface ElectionCandidate { user_id: number; name: string; reason: string; why_vote: string; changes: string; votes: number | null }
export interface ElectionSummary {
  village_id: string;
  sign: string;
  element: string;
  year: number;
  status: 'nomination' | 'voting' | 'closed';
  week: number;
  weeks: ElectionWeek[];
  candidates: { male: ElectionCandidate[]; female: ElectionCandidate[] };
  turnout: number;
  eligible_voters: number;
  winners: { male: string | null; female: string | null; male_votes: number; female_votes: number; term_start: string; term_end: string } | null;
  cycle_id: number;
}
export interface ElectionGuide {
  my_sign: string | null;
  my_gender: string;
  role: 'outside' | 'watch' | 'candidate' | 'can_stand' | 'voter_soon' | 'can_vote' | 'voted' | 'results';
  text: string;
  action: 'stand' | 'vote' | null;
  week: number;
  nominated: boolean;
  voted_genders: string[];
  can_stand: boolean;
  can_vote: boolean;
}
export const electionNominate = (form: { reason: string; why_vote?: string; changes?: string; past_work?: string }) =>
  api<{ status: string }>('/api/election/nominate', { body: form });
export const electionVote = (candidate_user_id: number, gender: 'male' | 'female') =>
  api<{ status: string }>('/api/election/vote', { body: { candidate_user_id, gender } });

// ---------- village sub-groups ----------
export interface SubGroup {
  id: number;
  name: string;
  description: string;
  my_status: 'pending' | 'approved' | 'declined' | null;
  members: number;
  pending?: { user_id: number; name: string }[];
}
export const subgroups = () => api<{ village: string | null; is_admin: boolean; groups: SubGroup[] }>('/api/subgroups');
export const createSubgroup = (name: string, description: string) => api<{ id: number }>('/api/subgroups', { body: { name, description } });
export const joinSubgroup = (id: number) => api<{ status: string }>(`/api/subgroups/${id}/join`, { body: {} });
export const decideSubgroup = (id: number, user_id: number, approve: boolean) =>
  api<{ status: string }>(`/api/subgroups/${id}/decide`, { body: { user_id, approve } });

// ---------- chats (village sub-groups, personal groups, private one-to-one) ----------
export interface ChatMessage {
  who?: string;
  user_id?: number;
  gender?: Gender | null;
  profile_picture_url?: string | null;
  mine: boolean;
  text: string;
  at: string;
}
/** 'family' = a Family Tree unit's chat (website 2026-10-26: /api/family-groups/<id>/messages).
 * 'local' = a Local Area's chat (website 2026-11-18: /api/local-areas/<id>/chat). */
export type ChatKind = 'sub' | 'group' | 'private' | 'family' | 'local';
export async function chatLoad(kind: ChatKind, id: number): Promise<{ title: string; messages: ChatMessage[]; extra?: unknown }> {
  if (kind === 'sub') {
    const r = await api<{ name: string; messages: ChatMessage[] }>(`/api/chat/${id}`);
    return { title: r.name, messages: r.messages };
  }
  if (kind === 'local') {
    const r = await api<{ name: string; messages: ChatMessage[] }>(`/api/local-areas/${id}/chat`);
    return { title: r.name, messages: r.messages };
  }
  if (kind === 'family') {
    const r = await api<{ name: string; messages: ChatMessage[]; members: MemberRow[]; is_admin: boolean }>(`/api/family-groups/${id}/messages`);
    return { title: r.name, messages: r.messages, extra: r };
  }
  if (kind === 'group') {
    const r = await api<{ name: string; messages: ChatMessage[]; members: MemberRow[]; is_owner: boolean }>(
      `/api/people/groups/${id}/messages`,
    );
    return { title: r.name, messages: r.messages, extra: r };
  }
  const r = await api<{ name: string; with: string; with_gender?: Gender | null; with_profile_picture_url?: string | null; left: boolean; other_left: boolean; other_account_id: string | null; messages: ChatMessage[] }>(
    `/api/people/chats/${id}`,
  );
  return { title: r.name, messages: r.messages, extra: r };
}
export function chatSend(kind: ChatKind, id: number, text: string) {
  const path =
    kind === 'sub'
      ? `/api/chat/${id}`
      : kind === 'local'
        ? `/api/local-areas/${id}/chat`
        : kind === 'group'
        ? `/api/people/groups/${id}/messages`
        : kind === 'family'
          ? `/api/family-groups/${id}/messages`
          : `/api/people/chats/${id}`;
  return api<{ status: string }>(path, { body: { text } });
}

// ---------- Unified Chat Architecture (website chat_core.py, 2026-11-24) ----------
// The read-side aggregator across all five ChatKinds above -- one list, each row tagged with
// exactly the `kind`/`id` chatLoad()/chatSend() already dispatch on, so opening a row from this
// list is the same navigation every existing per-context list screen (private-groups.tsx,
// Local Areas, Family Tree) already does, not a new mechanism.
export type ConversationPane = 'private' | 'channel';
export interface Conversation {
  kind: ChatKind;
  id: number;
  title: string;
  pane: ConversationPane;
  location_id: string | null;
  location_level: BoardLevel | null;
  other_user_id?: number; // 'private' rows only -- whose presence dot to show
  last_message_at: string | null;
  unread_count: number;
}
export function chatConversations() {
  return api<{ conversations: Conversation[] }>('/api/chat/conversations');
}

/** 'green' | 'yellow' | 'grey' | 'red' -- see the website's chat_core.presence_status() for the
 * exact thresholds (computed live from last_seen_at, never a stored status). */
export type PresenceStatus = 'green' | 'yellow' | 'grey' | 'red';
export function presenceBatch(userIds: number[]) {
  if (!userIds.length) return Promise.resolve({ statuses: {} as Record<number, PresenceStatus> });
  return api<{ statuses: Record<number, PresenceStatus> }>(`/api/presence/batch?user_ids=${userIds.join(',')}`);
}

// ---------- Economic Engine: Cases, the Member side only (website case_core.py, 2026-11-25) ----------
// Cases are deliberately NOT part of chat_core.list_my_conversations() or the ChatKind union above
// -- they're fetched separately and merged into the Home tab's list client-side, same as the
// website does (dashboard.js's loadConversations()), since a Case is a status-driven object (its
// own TID Comments log), not one of chat_core's existing kinds. The Agent Dashboard (Queue/
// Compass/Directory/History, the 3-column workspace) is desktop-only by deliberate decision --
// see docs/phone_app_redesign_phase1_proposal_2026_11_25.md §5 in the website repo -- so nothing
// Agent-facing is mirrored here.
export type CaseType = 'commerce' | 'service_request';
export type CaseStatus =
  | 'created' | 'agent_assigned' | 'supplier_contacted' | 'pending_supplier'
  | 'pending_payment' | 'in_progress' | 'resolved' | 'disputed' | 'escalated' | 'cancelled';
export interface CaseRow {
  id: number;
  case_type: CaseType;
  member_user_id: number;
  agent_user_id: number | null;
  supplier_user_id: number | null;
  location_id: string;
  location_level: BoardLevel;
  subject: string;
  status: CaseStatus;
  escrow_amount: number;
  chat_sub_id: number | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}
export function casesList(all = false) {
  return api<{ cases: CaseRow[] }>(`/api/cases/my-cases${all ? '?all=1' : ''}`);
}
export function createCase(case_type: CaseType, subject: string) {
  return api<CaseRow>('/api/cases/create', { body: { case_type, subject } });
}
export interface CaseLog {
  id: number;
  case_id: number;
  author_user_id: number | null;
  author_role: 'member' | 'agent' | 'supplier' | 'system' | 'council';
  log_type: string;
  message: string | null;
  visibility: 'member' | 'internal';
  created_at: string;
}
export function caseLogs(caseId: number) {
  return api<{ logs: CaseLog[] }>(`/api/cases/${caseId}/logs`);
}
export function caseMessage(caseId: number, message: string) {
  return api<CaseLog>(`/api/cases/${caseId}/message`, { body: { message } });
}
/** The Member UI's "Pay to Escrow" button -- locks `amount` Qoins into this Case's escrow. Only
 * valid while the Case is 'pending_payment'; enforced server-side (case_core.update_status()'s
 * own 'is_member_paying' exception), not re-checked here. */
export function payCaseEscrow(caseId: number, amount: number) {
  return api<CaseRow>(`/api/cases/${caseId}/pay`, { body: { amount } });
}

// ---------- Local Areas (website local_area_core, 2026-11-18) ----------
// Neighbourhoods inside a village, each with its own chat. A member is in at most one; the first
// join is free, every later one (moving, or rejoining after leaving) needs the village's Nayak /
// Nayika or the Founder to approve. Posting and voting stay on the Village board.
export interface LocalArea {
  id: number;
  name: string;
  member_count: number;
}
export interface LocalAreasList {
  local_areas: LocalArea[];
  /** The Local Area you're in now, if any. */
  my_local_area_id: number | null;
  /** A move (or rejoin) you've asked for that's waiting for approval. */
  my_pending_move_to: number | null;
  /** You can create Local Areas and decide move requests here (Founder, or this village's Nayak/Nayika). */
  can_manage: boolean;
}
export interface LocalAreaMoveRequest {
  id: number;
  user_id: number;
  user_name: string;
  from_local_area_id: number | null;
  from_name: string | null;
  to_local_area_id: number;
  to_name: string;
  requested_at: string;
}
export const localAreasList = (villageId: string) => api<LocalAreasList>(`/api/local-areas/list?village_id=${encodeURIComponent(villageId)}`);
export const localAreaCreate = (village_id: string, name: string) => api<{ id: number }>('/api/local-areas/create', { body: { village_id, name } });
export const localAreaJoin = (local_area_id: number) => api<{ local_area_id: number }>('/api/local-areas/join', { body: { local_area_id } });
export const localAreaRequestMove = (to_local_area_id: number) =>
  api<{ request_id: number; status: 'created' | 'already_pending' }>('/api/local-areas/request-move', { body: { to_local_area_id } });
export const localAreaLeave = () => api<{ ok: boolean }>('/api/local-areas/leave', { body: {} });
export const localAreaRequests = (villageId: string) =>
  api<{ requests: LocalAreaMoveRequest[] }>(`/api/local-areas/requests?village_id=${encodeURIComponent(villageId)}`);
export const localAreaDecide = (requestId: number, decision: 'approve' | 'deny') =>
  api<{ ok: boolean }>(`/api/local-areas/requests/${requestId}/decide`, { body: { decision } });

// ---------- personal timeline ----------
// 2026-09-28: groups moved from 5 fixed "kind" slots to a category with any number of groups
// (family/friends/business/custom); Family starts with Paternal/Maternal/Spouse-Family, Friends
// with one "Friends" group, Business empty except the Founder's own "Qumanity Team".
export type GroupCategory = 'family' | 'friends' | 'business' | 'custom';
export const GROUP_CATEGORIES: GroupCategory[] = ['family', 'friends', 'business', 'custom'];
export interface PersonalGroup {
  id: number;
  category: GroupCategory;
  name: string;
  members: number;
  mine: boolean;
  owner_name?: string;
  business_name: string | null;
  business_sector: string | null;
  business_services: string | null;
}
export type PersonalGroups = Record<GroupCategory, { owned: PersonalGroup[]; joined: PersonalGroup[] }>;
/** One Account ID per present-location stay. Only one is active; the readable account_id is never shown. */
export interface AccountIdRow {
  id: number;
  account_id: string;
  search_code: string;
  is_current: number;
  created_at: string;
  present_location_json: string;
}
export interface AccountIdRequest {
  id: number;
  present_location_json: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  decided_at: string | null;
}
export const peopleMe = () =>
  api<{ search_code: string; account_history: AccountIdRow[]; account_requests?: AccountIdRequest[] }>('/api/people/me');

// ---------- council / admin approvals ----------
export interface AdminAccountRequest {
  id: number;
  user_id: number;
  name: string;
  present_location_json: string;
  created_at: string;
}
export const adminAccountRequests = () => api<{ requests: AdminAccountRequest[] }>('/api/admin/account-ids');
export const decideAccountRequest = (id: number, approve: boolean) =>
  api<{ status: string }>(`/api/admin/account-ids/${id}/decide`, { body: { approve } });
export interface AdminReview {
  id: number;
  rating: number;
  text: string;
  allow_public: boolean;
  approved: boolean;
  name: string;
  place: string;
  at: string;
}
export const adminReviews = () => api<{ reviews: AdminReview[] }>('/api/admin/reviews');
export const approveReview = (id: number, approved: boolean) =>
  api<{ status: string }>(`/api/admin/reviews/${id}/approve`, { body: { approved } });

/** "Village › District › State" from a stored present_location_json. */
export function placeLine(json: string): string {
  try {
    const l = JSON.parse(json) as LocationStruct;
    return [l.village, l.tehsil, l.district, l.state]
      .filter(Boolean)
      .map((n) => n!.name)
      .slice(0, 3)
      .join(' › ') || (l.country?.name ?? '—');
  } catch {
    return '—';
  }
}
export const personalGroups = () => api<PersonalGroups>('/api/people/groups');
export const createGroup = (category: GroupCategory, name: string) => api<{ id: number }>('/api/people/groups/create', { body: { category, name } });
export const moveGroup = (groupId: number, category: GroupCategory) => api<{ status: string }>(`/api/people/groups/${groupId}/move`, { body: { category } });
export const renameGroup = (groupId: number, name: string) => api<{ status: string }>(`/api/people/groups/${groupId}/rename`, { body: { name } });
export const saveBusiness = (groupId: number, b: { name: string; sector: string; services: string }) =>
  api<{ status: string }>(`/api/people/groups/${groupId}/business`, { body: b });
/** Find someone by their 12-digit search code. (The website also returns the readable Account ID; the app never shows it.) */
export const searchPerson = (q: string) =>
  api<FoundPerson>(`/api/people/search?q=${encodeURIComponent(q)}`);
export const invite = (group_id: number, user_id: number) => api<{ status: string }>('/api/people/invite', { body: { group_id, user_id } });
/** Open (or find) a direct private chat with someone you already share a group with. */
export const openChatWith = (user_id: number) => api<{ chat_id: number }>('/api/people/open-chat', { body: { user_id } });
export const messageRequest = (user_id: number, text: string) => api<{ status: string }>('/api/people/message', { body: { user_id, text } });
export interface FoundPerson {
  user_id: number;
  /** For a hidden member this is their Account ID standing in for the name — never show it;
   * show "Private until you are family" when `hidden` (see components/ProfileCard). */
  name: string;
  gender: Gender;
  place: string | null;
  account_id?: string;
  profile_picture_url?: string | null;
  /** Website 2026-10-26: never masked. */
  age_group?: string | null;
  /** Village + state, or state only when hidden. */
  location?: string | null;
  hidden?: boolean;
  /** Website 2026-10-27: you already share an approved group (personal or Family Tree unit), so a
   * private chat can be opened directly (openChatWith) instead of sending a message request. */
  can_open_chat?: boolean;
}
export interface InboxItem {
  id: number;
  kind: 'message' | 'group' | 'rejoin' | 'family_group_join' | 'family_group_invite';
  from_user_id?: number;
  family_group_name?: string | null;
  first_message: string | null;
  created_at: string;
  status: 'pending' | 'waiting';
  from_name: string;
  group_name: string | null;
  group_category: string | null;
  chat_name: string | null; // set only for kind === 'rejoin' — the Private Group they want back into
}
export const inbox = () => api<{ requests: InboxItem[] }>('/api/people/inbox');
export const decide = (id: number, decision: 'accept' | 'decline' | 'waiting') =>
  api<{ status: string }>(`/api/people/inbox/${id}/decide`, { body: { decision } });

// ---------- account IDs: one per present-location stay, kept forever; only one is ever "current" ----------
export const switchAccount = (rowId: number) => api<{ status: string }>('/api/people/account-ids/switch', { body: { row_id: rowId } });
export const requestNewAccount = (present_location: Record<string, unknown>) =>
  api<{ status: string }>('/api/people/account-ids/request', { body: { present_location } });

// ---------- wallet ----------
export interface QoinsConfig {
  currency: string;
  currency_name: string;
  symbol: string;
  denominations: number[];
  /** No longer sent (donations were removed 2026-10-11); unused by the app. */
  max_donation?: number;
  village_prices: Record<string, unknown>;
  paid_prices: Record<string, Record<string, unknown>>;
}
export const qoinsConfig = () => api<QoinsConfig>('/api/qoins/config');
export const walletBalance = () =>
  api<{ balance_qoins: number; has_locked_share: boolean; transactions: { amount_qoins: number; reason: string; locked: number; created_at: string }[] }>(
    '/api/wallet/balance',
  );
/** A location group's wallet; Earth's id is "EARTH" (website convention). */
/** qoin_count (how many Qoins the place holds) is public; balance_qoins (the rupee value) is sent
 * only to an admin or that place's serving council (website _can_see_collective_wallet_value). */
export const groupWallet = (level: BoardLevel, id: string) =>
  api<{ qoin_count: number; balance_qoins?: number }>(`/api/wallet/balance/${level}/${encodeURIComponent(id)}`);
export interface WalletWeek {
  year: number;
  week: number;
  start: string;
  end: string;
  change: number;
  rows: { amount: number; reason: string; at: string }[];
}
export const walletHistory = () => api<{ balance_qoins: number; weeks: WalletWeek[]; older_weeks_hidden: number }>('/api/wallet/history');
export const topUpPreview = (amount: number) =>
  api<{ amount: number; qoins: number[]; topup: { own: number; village: number; own_qoins: number[]; village_qoins: number[] } | null }>(
    `/api/qoins/preview?amount=${amount}`,
  );

// ---------- election history ----------
// Party options and Lok Sabha years are per-country and can move (election_core.py: parties_for_country,
// loksabha_years) -- council-editable, never hardcoded here. loksabha_years is always [past, past, next],
// rolling forward on its own once the "next" year shown has itself passed.
export interface ElectionHistory {
  party: {
    loksabha_years: number[];
    loksabha: Record<string, string | null>;
    vidhansabha: { last: string | null; next: string | null };
  };
  qpunch: { year: number; sign: string; candidate: string; won: boolean }[];
  parties: [string, string][]; // [code, label], e.g. ["BJP", "BJP / NDA Alliance"] ... ["NOTVOTED", "Not Voted"]
}
export const electionHistory = () => api<ElectionHistory>('/api/election-history');
export const saveElectionHistory = (party: ElectionHistory['party']) => api<{ status: string }>('/api/election-history', { body: party });

// ---------- settings ----------
export const setDailyLanguage = (daily: string) => api<{ languages: Language[] }>('/api/user/languages', { body: { daily } });

// ---------- statistics (location explorer) ----------
export interface PlaceStats {
  /** A count of 1-4 arrives as the string "<5" (website small-count suppression). */
  total_humans: number | string;
  elements: Record<string, number>;
  gender: Record<string, number>;
  signs: Record<string, number>;
  age_bands: { code: string; count: number; label: string }[];
}
export const placeStats = (level: BoardLevel, id: string) =>
  api<PlaceStats>(level === 'earth' ? '/api/earth/stats' : `/api/location/stats/${level}/${encodeURIComponent(id)}`);

/** The 10 countries of the Indian Sub-continent (app.py's SUBCONTINENT_COUNTRY_IDS) — every
 * user's present location is one of these; India is the pilot country. */
export const SUBCONTINENT_COUNTRIES: { id: string; name: string }[] = [
  { id: 'O_AS_IND', name: 'India' },
  { id: 'O_AS_NPL', name: 'Nepal' },
  { id: 'O_AS_BTN', name: 'Bhutan' },
  { id: 'O_AS_BGD', name: 'Bangladesh' },
  { id: 'O_AS_MMR', name: 'Myanmar' },
  { id: 'O_AS_LKA', name: 'Sri Lanka' },
  { id: 'O_AS_PAK', name: 'Pakistan' },
  { id: 'O_AS_BLC', name: 'Balochistan' },
  { id: 'O_AS_AFG', name: 'Afghanistan' },
  { id: 'O_AS_MDV', name: 'Maldives' },
];

// ---------- poems marquee (docs: same poems as the website, /api/poems/*, no sign-in needed) ----------
export interface PoemsMeta {
  count: number;
  languages: { code: string; label: string; available: boolean }[];
  personal: boolean;
  default?: string;
}
export interface Poem {
  index: number;
  id: number | string;
  marker: string;
  text: string;
}
export const poemsMeta = () => api<PoemsMeta>('/api/poems/meta');
export const poem = (lang: string, index: number) => api<Poem>(`/api/poems/${lang}/${index}`);

// ---------- notifications (unread Personal-timeline chats + pending people-requests) ----------
export interface NotificationSummary {
  unread_chats: number;
  unread_private: number;
  unread_groups: number;
  pending_requests: number;
  /** Replies from Admin to questions this member asked (website 2026-10; read in Qmail). */
  unread_queries?: number;
  /** Replies from this member's Q-Punch council to messages they sent (read in Qmail). */
  unread_council?: number;
  /** Includes unread_queries + unread_council — the app has no Qmail, so the Notifications
   * screen lists those two as rows that open Qmail on the website. */
  total: number;
  /** Something to do in this month's election (stand in week 1, vote in weeks 2-3), else null. */
  election?: { sign: string; week: number; action: 'stand' | 'vote'; text: string } | null;
}
export const notificationSummary = () => api<NotificationSummary>('/api/notifications/summary');

// ---------- Private Groups: 1:1 chats opened by an accepted message request (2026-09-28) ----------
// Both members are admins: either can rename the chat or leave it (history stays readable, but a
// left member can't send or see new messages until the other approves a rejoin request).
export interface PrivateChat {
  chat_id: number;
  name: string;
  with: string;
  with_gender?: Gender | null;
  with_profile_picture_url?: string | null;
  left: boolean;
  last: string | null;
  at: string | null;
}
export const privateChats = () => api<{ chats: PrivateChat[] }>('/api/people/chats');
export const renamePrivateChat = (chatId: number, name: string) => api<{ status: string }>(`/api/people/chats/${chatId}/rename`, { body: { name } });
export const leavePrivateChat = (chatId: number) => api<{ status: string }>(`/api/people/chats/${chatId}/leave`, { body: {} });
export const requestRejoinChat = (chatId: number) => api<{ status: string }>(`/api/people/chats/${chatId}/request-rejoin`, { body: {} });

// ---------- Private account: relationship status + work profile (2026-09-28) ----------
export type RelationshipStatus = 'single' | 'married' | 'divorced_widowed';
export type WorkProfile = 'unemployed_student' | 'employed' | 'govt' | 'security' | 'medical' | 'other';
export interface PersonalDetails {
  relationship_status: RelationshipStatus | null;
  has_children: boolean | null;
  sons_count: number;
  daughters_count: number;
  work_profile: WorkProfile | null;
  work_profile_other: string | null;
}
export const personalDetails = () => api<PersonalDetails>('/api/profile/personal-details');
export const savePersonalDetails = (d: Partial<PersonalDetails>) => api<{ status: string }>('/api/profile/personal-details', { body: d });

// ---------- app tour + the one-time rating & review (website review_core.py) ----------
export const REVIEW_MAX_CHARS = 100;
export interface Onboarding {
  tour: 'done' | 'skipped' | null;
  review_done: boolean;
}
export const onboarding = () => api<Onboarding>('/api/onboarding');
export const setTour = (status: 'done' | 'skipped') => api<Onboarding>('/api/onboarding/tour', { body: { status } });
export const submitReview = (rating: number, text: string, allow_public: boolean) =>
  api<{ status: string }>('/api/reviews', { body: { rating, text, allow_public, client: 'app' } });
export const declineReview = () => api<{ status: string }>('/api/reviews', { body: { decline: true } });
export interface PublicReviews {
  count: number;
  average: number | null;
  reviews: { rating: number; text: string; name: string; place: string; at: string }[];
}
export const publicReviews = () => api<PublicReviews>('/api/reviews/public');

// ---------- election percentages: National Election on Country pages, State Election on State pages ----------
// The backend gates this behind visibility_core.election_history_visibility (hidden until 2028,
// an early-unlock threshold, or an Admin override) -- when hidden it returns the `visible: false`
// shape below with no label/total_responses/parties at all, not just empty ones.
export type ElectionSentiment =
  | { visible: false; level: 'country' | 'state'; reason: string }
  | {
      visible: true;
      level: 'country' | 'state';
      label: string;
      total_responses: number;
      parties: { code: string; label: string; count: number; pct: number }[];
    };
export const electionSentiment = (level: 'country' | 'state', id: string) =>
  api<ElectionSentiment>(`/api/election-sentiment/${level}/${encodeURIComponent(id)}`);

// ---------- website dashboard parity (2026-09-29): time-box, moon, karma, perception, referrer, profile change ----------
export interface TimeBox {
  date: string;
  time: string;
  tz_abbr: string;
  place: string;
  sunrise: string;
  sunset: string;
  note?: string;
  panchang: { vaar: string; tithi: string; nakshatra: string; chandra_maas: string; surya_maas: string };
  sky: { ascendant: string; houses: { n: number; sign: string; asc: boolean; planets: { planet: string; text: string }[] }[] };
}
export const timebox = () => api<TimeBox>('/api/timebox');
export interface LunarPhase {
  current: { phase_name: string; illuminated_fraction: number };
  upcoming: { date: string; time: string; event_type: string; description: string; nakshatra?: string; zodiac_sign?: string; is_visible_in_india?: boolean }[];
}
export const lunarPhase = () => api<LunarPhase>('/api/lunar/phase');
export interface Karma {
  score: { commercial: number; noncommercial: number; total: number };
  history: { points?: number; reason?: string; at?: string; [k: string]: unknown }[];
}
export const karma = () => api<Karma>('/api/karma/me');

export interface Perception {
  /** null while the results are hidden (results_visible false) -- the Founder opens them. */
  pro_count: number | null;
  anti_count: number | null;
  results_visible?: boolean;
  results_reason?: string;
  can_vote: boolean;
  my_vote: 'pro' | 'anti' | null;
  vote_reason?: string;
  voting_year: number;
  window: { status: string; window_start: string; window_end: string };
}
export const perception = (kind: 'country' | 'zone', id: string) => api<Perception>(`/api/perception/${kind}/${encodeURIComponent(id)}`);
export const perceptionVote = (kind: 'country' | 'zone', id: string, vote: 'pro' | 'anti') =>
  api<{ status: string }>(`/api/perception/${kind}/${encodeURIComponent(id)}/vote`, { body: { vote } });

export const referrerMe = () => api<{ code: { code: string; uses: number } | null; pending: boolean }>('/api/referrer/me');
export const referrerApply = (note: string) => api<{ status: string }>('/api/referrer/apply', { body: { note } });

/** Name/email/phone changes, and DOB/time/places which only a council can approve. */
export const requestProfileChange = (fields: { name?: string; middle_name?: string; email?: string; phone?: string; dob?: string; tob?: string; reason: string }) =>
  api<{ status?: string; message?: string }>('/api/dashboard/edit-request', { body: fields });

// ---------- website parity (2026-10-06) ----------
export const collectiveKarma = (level: BoardLevel, id: string) =>
  api<{ points: number }>(`/api/karma/collective/${level}/${encodeURIComponent(id)}`);
export interface Scoreboard {
  total_members: number;
  zones: { id: string; name: string; rank: number; total_users: number }[];
  states: { id: string; name: string; rank: number; total_users: number; zone_id: string }[];
}
export const scoreboardIndia = () => api<Scoreboard>('/api/scoreboard/india');
export interface FounderMessage { title: string; preview_text: string; full_text: string; language: string; published_at: string }
export const founderMessage = (lang = 'en') => api<FounderMessage>(`/api/founder-message?lang=${encodeURIComponent(lang)}`);
export interface MoonKundali {
  chart_svg: string;
  ascendant_note?: string;
  table: { point: string; sign: string; element: string; nakshatra: string; nakshatra_lord: string; pada: number; degree: string; house: number }[];
  house_strength: Record<string, { sign: string; occupants: string[]; status: 'strong' | 'weak' | 'neutral' }>;
  elemental_balance: { counts: Record<string, number>; dominant: string };
  dasha: { current: { lord: string; start: string; end: string }; next?: { lord: string; start: string; end: string }[] };
}
export const myKundali = () => api<MoonKundali>('/api/me/kundali');
export const setPreferredLanguage = (preferred: string) =>
  api<{ languages: Language[]; preferred: string | null }>('/api/user/languages', { body: { preferred } });

// ---------- website sync 2026-10-26: profile pictures, member lists, Family Tree ----------
export type Gender = 'male' | 'female' | 'both';

/** Picture URL for a user id when the response didn't include one (e.g. inbox rows). The website
 * answers 404 when there is no picture or the viewer may not see it; Avatar then shows initials. */
export const pictureUrlFor = (userId: number) => `/api/users/${userId}/profile-picture`;

/** Self-service and immediate (no council approval). png/jpg/webp, max 3 MB; the website
 * re-encodes to a 256px square JPEG and strips EXIF (incl. GPS). Multipart field "picture". */
export const uploadProfilePicture = (file: { uri: string; name: string; type: string }) =>
  upload<{ status: 'ok' }>('/api/profile/picture', 'picture', file);

/** One row of a group's Members list (social_core.member_display_row) — personal group chats
 * and Family units alike. Name/location are already masked for a hidden identity. */
export interface MemberRow {
  /** null for a Family Tree placeholder nobody has claimed yet (no account behind the name). */
  user_id: number | null;
  /** Set on unclaimed Family Tree rows (website fd241f9); claimed rows carry user_id instead. */
  node_id?: number | null;
  name: string;
  gender: Gender | null;
  age_group: string | null;
  present_location: string | null;
  profile_picture_url: string | null;
  is_admin: boolean;
  /** Website fd241f9: strictly 'admin' or 'member' — admin rights over THIS group. ('founder' is
   * retired: it showed for any husband/wife, even in units where they held no admin rights.) */
  role?: 'admin' | 'member';
  you: boolean;
  /** false = a Family Tree placeholder with no account yet; true for every real member. */
  claimed: boolean;
  /** Family Tree placeholders only (website 7699cc6): this person has passed away. */
  is_deceased?: boolean;
}

export interface FamilyPerson {
  id: number; // family_nodes.id
  name: string;
  gender: Gender | null;
  status: string;
  claimed: boolean;
  is_deceased: boolean;
  is_viewer: boolean;
  profile_picture_url: string | null;
  /** e.g. "Father", "Son", "Spouse" (website family_core._relationship_label); null for yourself
   * or a relative outside the named list. */
  relationship_to_viewer?: string | null;
  /** A family admin's manual order among siblings (0 = eldest), used when no date of birth is known (website 7567c2f). */
  birth_order?: number | null;
  /** Unclaimed people only: an estimated date of birth (website 7567c2f). */
  dob_approx?: string | null;
  age_years?: number | null;
}
export interface FamilyUnitBrief {
  group_id: number;
  name: string;
  husband: FamilyPerson | null;
  wife: FamilyPerson | null;
  is_dormant: boolean;
  /** The unit's whole household (website 21d4016 cascade): founders + sons' households
   * (recursively) + unmarried children, linked or not. THE count to display. */
  recursive_member_count: number;
  /** Per founder, live (website 21d4016). Use for the founders' 🕊️ marker. */
  founder_is_deceased: { husband: boolean; wife: boolean };
  /** On parent units: which founder's birth unit this is. */
  side?: 'husband' | 'wife';
}
export interface FamilyNeighborhood extends FamilyUnitBrief {
  is_admin: boolean;
  /** OLD flat count (approved chat-roster accounts). Kept only for backward compatibility —
   * DON'T DISPLAY; show `recursive_member_count` instead. */
  members: number;
  unmarried_children: FamilyPerson[];
  parent_groups: FamilyUnitBrief[];
  child_groups: FamilyUnitBrief[];
}
export interface FamilyStatus {
  activated: boolean;
  /** Not activated, but a relative already placed them in a tree with parents (website 2026-10-26):
   * call familyActivateLinked() — no wizard needed. */
  linked_into_tree?: boolean;
  groups: { id: number; name: string; kind?: string; is_admin: number | boolean; is_founder: boolean; members: number }[];
}
export const familyStatus = () => api<FamilyStatus>('/api/family/status');
/** For a linked_into_tree member: records the activation and returns their units (already_activated). */
export const familyActivateLinked = () =>
  api<{ already_activated: true; groups: FamilyStatus['groups'] }>('/api/family/activate', { body: {} });
/** Despite "node" in the path, the id is a family unit (family_groups.id). 404 = not a member. */
export const familyNeighborhood = (groupId: number) => api<FamilyNeighborhood>(`/api/family/node/${groupId}/neighborhood`);
export const familyMembers = (groupId: number) => api<{ members: MemberRow[] }>(`/api/family-groups/${groupId}/members`);
/** Takes a RESOLVED user_id — look the Public ID up with searchPerson first (website HANDOVER §4.15). */
export const familyInvite = (groupId: number, user_id: number) =>
  api<{ status: 'invited' }>(`/api/family-groups/${groupId}/invite`, { body: { user_id } });
export const familyJoinRequest = (groupId: number) => api<{ status: 'requested' }>(`/api/family-groups/${groupId}/join-request`, { body: {} });
/** Leave rules (website 2026-10-26): own unit (founder) never; birth unit not while unmarried, or
 * while your parents/children are active members there; in-laws' unit any time. A 400 explains why.
 * After leaving, only an admin's invite brings you back. */
export const familyLeave = (groupId: number) => api<{ status: 'left' }>(`/api/family-groups/${groupId}/leave`, { body: {} });
/** Link an unclaimed person in the tree (any node, not only founders) to a real member by their
 * 12-digit Public ID. Only an admin of a unit that person belongs to may do this. */
export const familyLinkNode = (nodeId: number, publicId: string) =>
  api<{ status: string }>(`/api/family/node/${nodeId}/link`, { body: { user_id: publicId } });
/** Admins only; a founder can't be removed. The removed member's place in the tree stays. */
export const familyRemoveMember = (groupId: number, user_id: number) =>
  api<{ status: 'removed' }>(`/api/family-groups/${groupId}/remove-member`, { body: { user_id } });

/** A new person added by hand: an unlinked placeholder ("Tap to link") until someone links them. */
export interface FamilyNewPerson {
  name: string;
  gender?: Gender;
  is_deceased?: boolean;
  /**
   * Website e8b85e7 (merge-aware relations): 'create' a new placeholder (the default); 'join' reuse
   * a placeholder already in another tree (matched_node_id; only while nobody has claimed it);
   * 'notify' ask someone already on Qumanity to confirm (user_id) — a placeholder holds their place
   * until they accept. Stops the same person being added twice in separate trees.
   */
  action?: 'create' | 'join' | 'notify';
  matched_node_id?: number;
  user_id?: number;
}
/** Add a child / sibling / spouse to a person in the tree (website 2026-11-01 profile-card routes).
 * The server checks who may do it (admin of the right unit) and explains any refusal.
 * `group_id` (child only): which of the person's units the child belongs to — the one in view. */
export const familyAddRelative = (kind: 'child' | 'sibling' | 'spouse', nodeId: number, body: FamilyNewPerson & { group_id?: number }) =>
  api<{ node_id?: number; group_id?: number; notified?: { name: string; user_id: number }[] }>(`/api/family/person/${nodeId}/${kind}`, { body });
/** A manual birth order among siblings (0 = eldest), used only where no date of birth is known —
 * a known date always decides (website family_core._sort_people_by_birth). null clears it. */
export const familySetBirthOrder = (nodeId: number, birth_order: number | null) =>
  api<{ status: string }>(`/api/family/node/${nodeId}/birth-order`, { body: { birth_order } });
/** One person's own family as the tree knows it (website family_core.cascade_for_node): their
 * parents' unit and siblings, both grandparent units (tagged paternal / maternal), their spouse,
 * unmarried children and married children's units. Read-only, one generation each way of the
 * parents / children. 404 unless you're a member of a unit this person belongs to. */
export interface FamilyCascade {
  node: FamilyPerson;
  birth_group_id: number | null;
  parents: { father: FamilyPerson | null; mother: FamilyPerson | null } | null;
  siblings: FamilyPerson[];
  grandparent_groups: (Omit<FamilyUnitBrief, 'side'> & { side: 'paternal' | 'maternal' })[];
  marital_group_id: number | null;
  spouse: FamilyPerson | null;
  children: FamilyPerson[];
  child_groups: FamilyUnitBrief[];
}
export const familyCascade = (nodeId: number) => api<FamilyCascade>(`/api/family/person/${nodeId}/cascade`);
/** Add a founder's parents (one side of a unit), as the wizard does: at least one name. */
export const familyAddParents = (groupId: number, side: 'husband' | 'wife', father: FamilySlot | null, mother: FamilySlot | null) =>
  api<{ parent_group_id?: number }>(`/api/family/node/${groupId}/add-parents`, { body: { side, father, mother } });

// ---------- Family Tree activation (website family.js wizard; family_core.activate/marry_timeline) ----------
export type Relationship = 'single' | 'married' | 'separated' | 'divorced' | 'widowed';
/** One person in the wizard. "create" = new profile; "join" = request to join an existing unit
 * (group_id + matched_node_id from familySuggest); "notify" = an existing member (user_id) is
 * pinged to activate, and their own node is reused if they already have one. */
export interface FamilySlot {
  name: string;
  action: 'create' | 'join' | 'notify';
  is_deceased?: boolean;
  gender?: Gender;
  group_id?: number;
  matched_node_id?: number;
  user_id?: number;
}
export type FamilySuggestion =
  | {
      type: 'group';
      group_id: number;
      group_name: string;
      group_kind?: string;
      matched_node_id: number;
      matched_name: string;
      member_count: number;
      /** The unit's founders (website 2026-10-26) — units can share a name, so show who they are. */
      husband_name?: string | null;
      wife_name?: string | null;
      /** How the matched person sits in this unit; a spouse may join only where they are a founder
       * with an unclaimed partner place. */
      matched_role?: 'husband' | 'wife' | 'child';
      partner_slot_open?: boolean;
    }
  | { type: 'unactivated_user'; user_id: number; name: string; gender: Gender | null; profile_picture_url: string | null };
/** The website also returns other discovery kinds (e.g. activated members nearby); the wizard,
 * like the website's, only uses these two. */
export const isWizardSuggestion = (r: { type: string }): r is FamilySuggestion => r.type === 'group' || r.type === 'unactivated_user';
export const familySuggest = (name: string) =>
  api<{ results: { type: string }[] }>(`/api/family/suggest?name=${encodeURIComponent(name)}`);

export interface FamilyResult {
  joined_requests: { label: string; name: string; group_id: number }[];
  /** Per person: the node made or reused; linked_existing = a linked member's own place was reused. */
  created_node_ids?: { label: string; node_id: number; name: string; linked_existing?: boolean; is_deceased?: boolean }[];
  notified: { label: string; name: string; user_id: number }[];
  parents_group_id?: number;
  parents_group_name?: string;
  marital_group_id?: number;
  marital_group_name?: string;
  /** Set when the spouse already founds a unit and this member asked to claim the partner place:
   * the children listed in the wizard were not added (that unit's admins can add them). */
  children_not_added?: number;
  /** Marriage is automatic (website 2026-10-26): the member joined the spouse's unit as co-founder
   * (admin) and the spouse's parents' unit as a member — no approval. */
  auto_joined?: { label: string; name: string; group_id: number };
}
export const familyActivate = (body: {
  father: FamilySlot;
  mother: FamilySlot;
  relationship: Relationship;
  father_father?: FamilySlot | null;
  father_mother?: FamilySlot | null;
  mother_father?: FamilySlot | null;
  mother_mother?: FamilySlot | null;
}) => api<FamilyResult>('/api/family/activate', { body });
/** Married/separated/divorced/widowed only, and only after activation. */
export const familyMarry = (body: {
  spouse: FamilySlot;
  children: FamilySlot[];
  marriage_status: 'active' | 'separated' | 'dissolved';
  spouse_father?: FamilySlot | null;
  spouse_mother?: FamilySlot | null;
}) => api<FamilyResult>('/api/family/marry', { body });
