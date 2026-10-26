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
}

// ---------- auth ----------
export const login = (privateId: string, pin: string) =>
  api<{ token: string }>('/login', { body: { private_id: privateId, pin, client: 'app' } });

export interface RegisterBody {
  name: string;
  gender: 'male' | 'female' | 'both';
  dob: string;
  tob: string;
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
  donation: unknown;
  donation_error: string | null;
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
export type ChatKind = 'sub' | 'group' | 'private';
export async function chatLoad(kind: ChatKind, id: number): Promise<{ title: string; messages: ChatMessage[]; extra?: unknown }> {
  if (kind === 'sub') {
    const r = await api<{ name: string; messages: ChatMessage[] }>(`/api/chat/${id}`);
    return { title: r.name, messages: r.messages };
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
  const path = kind === 'sub' ? `/api/chat/${id}` : kind === 'group' ? `/api/people/groups/${id}/messages` : `/api/people/chats/${id}`;
  return api<{ status: string }>(path, { body: { text } });
}

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
export const messageRequest = (user_id: number, text: string) => api<{ status: string }>('/api/people/message', { body: { user_id, text } });
export interface FoundPerson {
  user_id: number;
  name: string;
  gender: Gender;
  place: string | null;
  account_id?: string;
  profile_picture_url?: string | null;
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
  max_donation: number;
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
  user_id: number;
  name: string;
  gender: Gender | null;
  age_group: string;
  present_location: string | null;
  profile_picture_url: string | null;
  is_admin: boolean;
  you: boolean;
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
}
export interface FamilyUnitBrief {
  group_id: number;
  name: string;
  husband: FamilyPerson | null;
  wife: FamilyPerson | null;
  is_dormant: boolean;
  /** On parent units: which founder's birth unit this is. */
  side?: 'husband' | 'wife';
}
export interface FamilyNeighborhood extends FamilyUnitBrief {
  is_admin: boolean;
  members: number;
  unmarried_children: FamilyPerson[];
  parent_groups: FamilyUnitBrief[];
  child_groups: FamilyUnitBrief[];
}
export interface FamilyStatus {
  activated: boolean;
  groups: { id: number; name: string; kind?: string; is_admin: number | boolean; is_founder: boolean; members: number }[];
}
export const familyStatus = () => api<FamilyStatus>('/api/family/status');
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
/** Admins only; a founder can't be removed. The removed member's place in the tree stays. */
export const familyRemoveMember = (groupId: number, user_id: number) =>
  api<{ status: 'removed' }>(`/api/family-groups/${groupId}/remove-member`, { body: { user_id } });

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
