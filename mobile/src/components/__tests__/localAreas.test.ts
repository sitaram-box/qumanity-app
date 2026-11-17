import { describe, expect, it } from 'vitest';
import { rowState } from '../localAreas.logic';

describe('Local Areas: what each row offers', () => {
  it('in no Local Area, nothing pending: Join on every row', () => {
    const l = { my_local_area_id: null, my_pending_move_to: null };
    expect([rowState(1, l), rowState(2, l)]).toEqual(['join', 'join']);
  });

  it('in Block A: Current Area there, Request Move on the others', () => {
    const l = { my_local_area_id: 1, my_pending_move_to: null };
    expect([rowState(1, l), rowState(2, l)]).toEqual(['current', 'move']);
  });

  it('a move to Block B pending: Move Pending there, still Current in A, Request Move elsewhere', () => {
    const l = { my_local_area_id: 1, my_pending_move_to: 2 };
    expect([rowState(1, l), rowState(2, l), rowState(3, l)]).toEqual(['current', 'pending', 'move']);
  });

  it('left, then asked to rejoin (pending, no current area): no free Join offered anywhere', () => {
    const l = { my_local_area_id: null, my_pending_move_to: 2 };
    expect([rowState(1, l), rowState(2, l)]).toEqual(['move', 'pending']);
  });
});
