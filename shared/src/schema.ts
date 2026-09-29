/**
 * Firestore collections and document shapes (docs/DEVELOPMENT_PLAN.md §14).
 * Timestamps are `unknown` so this file stays SDK-agnostic.
 */

import type { AgeType, Gender } from './ids';
import type { GroupMode, PersonalKind, RequestStatus, RequestType, Timeline } from './groups';
import type { Level } from './tiers';
import type { PostStatus, Vote } from './posts';

export const COL = {
  users: 'users',
  accounts: 'accounts',
  identities: 'identities',
  accountIdentities: 'account_identities',
  secrets: 'secrets',
  idRegistry: 'id_registry',
  counters: 'counters',
  locations: 'locations',
  groups: 'groups',
  requests: 'requests',
  uidLinks: 'uid_links',
  config: 'config',
  pinSalts: 'pin_salts',
  pinChecks: 'pin_checks',
  chats: 'chats',
  elections: 'elections',
  revealLog: 'reveal_log',
} as const;

export const SUB = {
  council: 'council',
  house: 'house',
  members: 'members',
  socialWorkers: 'social_workers',
  messages: 'messages',
  timeline: 'timeline',
  votes: 'votes',
  scoreShards: 'score_shards',
  comments: 'comments',
  privatePosts: 'private_posts',
  contacts: 'contacts',
} as const;

/** Group ids along a present-location chain, keyed by level (hidden tiers absent). */
export type Chain = Partial<Record<Level, string>>;

export interface LocationRef {
  id: string;
  name: string;
  level: Level;
  country_id: string;
}

/** users/{userId} — readable only by the user themself. */
export interface UserDoc {
  user_id: string;
  auth_uid: string;
  phone: string;
  name: string;
  gender: Gender;
  dob: string;
  tob: string;
  language: string;
  zodiac_type: string;
  age_type: AgeType;
  account_id: string;
  account_ids: string[];
  birth_location: LocationRef;
  present_location: LocationRef;
  chain: Chain;
  personal_groups: Partial<Record<PersonalKind, string>>;
  fcm_tokens: string[];
  pin_set: boolean;
  created_at: unknown;
}

/** accounts/{accountId} — public profile, found by searching the 10-digit Account ID. */
export interface AccountDoc {
  account_id: string;
  display_name: string;
  photo_url: string | null;
  village_name: string;
  village_group: string | null;
  active: boolean;
  created_at: unknown;
}

/** identities/{userId} and account_identities/{accountId} — server-only. */
export interface IdentityDoc {
  readable_id: string;
  user_id: string;
  serial: number;
  location_id: string;
  created_at: unknown;
}

export interface LocationDoc {
  id: string;
  name: string;
  level: Level;
  parent_id: string | null;
  country_id: string | null;
  label: string | null;
  has_children: boolean;
  group_id?: string;
}

export interface GroupDoc {
  group_id: string;
  name: string;
  timeline: Timeline;
  mode: GroupMode;
  level?: Level;
  code?: string; // location id
  parent_group?: string | null;
  kind?: PersonalKind;
  owner_id?: string;
  /** Seats 1–5 kept inside the group doc (no sub-collection: saves writes on Spark). */
  council: Partial<Record<'1' | '2' | '3' | '4' | '5', CouncilSeat>>;
  council_ids: string[];
  is_active: boolean;
  user_count: number;
  last_message?: { text: string; sender_account: string; at: unknown };
  created_at: unknown;
}

export interface CouncilSeat {
  title: string;
  method: 'appointed' | 'elected' | 'hired';
  holder_id: string | null;
  since: unknown;
  term_end: unknown | null;
}

export type MessageType = 'text' | 'image' | 'document' | 'audio';

export interface MessageDoc {
  sender_account: string;
  type: MessageType;
  text?: string;
  media_url?: string;
  media_meta?: { name?: string; size?: number; mime?: string; duration_ms?: number };
  reply_to?: string;
  timestamp: unknown;
  read_by?: string[];
  deleted?: boolean;
}

export interface TimelinePostDoc {
  author_account: string;
  content: string;
  media_url?: string;
  level: Level;
  score: number;
  voter_count: number;
  voting_start: unknown;
  voting_end: unknown;
  status: PostStatus;
  origin_post: string | null;
  origin_group: string;
  elevated_to: string | null;
  earth_honour?: boolean;
  comment_count: number;
}

export interface VoteDoc {
  value: Vote;
  at: unknown;
}

export interface RequestDoc {
  from_account: string;
  to_account: string;
  type: RequestType;
  first_message: string | null;
  status: RequestStatus;
  created_at: unknown;
  responded_at: unknown | null;
}

export interface ChatDoc {
  participants: [string, string]; // Account IDs
  last_message?: { text: string; sender_account: string; at: unknown };
  created_at: unknown;
}
