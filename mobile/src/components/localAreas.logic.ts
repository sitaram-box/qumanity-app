/**
 * Local Areas: what each row of the list offers, from the website's own facts about the caller
 * (my_local_area_id, my_pending_move_to). Free of React / React Native imports so it can be
 * unit-tested under plain vitest (same reason as pin.logic.ts). The website re-checks every action
 * and explains any refusal (e.g. rejoining after leaving needs approval).
 */

import type { LocalAreasList } from '@/api/qumanity';

export type RowState =
  /** You're in this one: Current Area badge, Open chat, Leave. */
  | 'current'
  /** You asked to move here; waiting for approval. */
  | 'pending'
  /** You're in no Local Area and nothing is pending: Join (the first join is free). */
  | 'join'
  /** You're elsewhere (or a request is pending elsewhere): Request Move. */
  | 'move';

export function rowState(areaId: number, list: Pick<LocalAreasList, 'my_local_area_id' | 'my_pending_move_to'>): RowState {
  if (list.my_local_area_id === areaId) return 'current';
  if (list.my_pending_move_to === areaId) return 'pending';
  if (list.my_local_area_id === null && list.my_pending_move_to === null) return 'join';
  return 'move';
}
