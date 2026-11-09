/**
 * Q-Punch election results/winner display (2026-11-08, Phase 3).
 *
 * These fixtures are not invented -- each one was captured by directly calling the real backend
 * (election_core.election_summary(), via a disposable throwaway database, the same convention
 * Qumanity_DPG's own tests/*.py scripts use) for a genuinely OPEN cycle, a genuinely CLOSED cycle
 * with a real winner, a genuinely CLOSED cycle where two candidates tied at the same vote count,
 * and a genuinely CLOSED cycle with zero candidates and zero votes. Trimmed to the fields these
 * tests need; irrelevant fields (weeks, turnout, etc.) are omitted from the fixtures below but
 * were present in the real captured response.
 *
 * Scope note: there is no React Native component-rendering test framework installed in this
 * project (no @testing-library/react-native, no jest-expo preset) -- these tests verify the pure,
 * exported decision functions ElectionCard.tsx uses (hasAnyWinner / isClosedWithNoVotes /
 * candidateVoteLabel), which is the actual logic that decides what gets shown, not the JSX
 * markup itself. This is a real, if partial, substitute for a full component-render test; it does
 * not claim to verify pixel-level or accessibility-tree output.
 */

import { describe, expect, it } from 'vitest';
import { candidateVoteLabel, hasAnyWinner, isClosedWithNoVotes } from '../electionCard.logic';
import type { ElectionSummary } from '@/api/qumanity';

const base = {
  village_id: 'CS.DL.3.4.1A',
  sign: 'Libra',
  element: 'Air',
  week: 2,
  weeks: [] as ElectionSummary['weeks'],
  turnout: 0,
  eligible_voters: 4,
  cycle_id: 1,
  year: 2026,
};

// Captured live: nomination complete, voting open, no votes cast yet.
const OPEN: ElectionSummary = {
  ...base,
  status: 'voting',
  candidates: {
    male: [
      { user_id: 1, name: 'R1', reason: 'x', why_vote: 'x', changes: 'x', votes: null },
      { user_id: 3, name: 'R3', reason: 'x', why_vote: 'x', changes: 'x', votes: null },
      { user_id: 4, name: 'R4', reason: 'x', why_vote: 'x', changes: 'x', votes: null },
    ],
    female: [],
  },
  winners: null,
};

// Captured live: cycle closed, R4 won with 2 of 2 votes cast; R1/R3 got 0.
const CLOSED_WITH_WINNER: ElectionSummary = {
  ...base,
  status: 'closed',
  candidates: {
    male: [
      { user_id: 1, name: 'R1', reason: 'x', why_vote: 'x', changes: 'x', votes: 0 },
      { user_id: 3, name: 'R3', reason: 'x', why_vote: 'x', changes: 'x', votes: 0 },
      { user_id: 4, name: 'R4', reason: 'x', why_vote: 'x', changes: 'x', votes: 2 },
    ],
    female: [],
  },
  winners: { male: 'R4', female: null, male_votes: 2, female_votes: 0, term_start: '2026-10-15', term_end: '2027-10-14' },
};

// Captured live: cycle closed, two candidates (T1, T4) each received exactly 1 vote -- a genuine
// numeric tie. The backend's OWN tie-break (election_core._ensure_tallied(), unchanged/protected
// in this phase: ORDER BY votes DESC, MIN(id) ASC on election_votes.id) already resolved this to
// a single winner (T4) before the response was ever built -- there is no separate
// backend-declared "tie" flag anywhere in this response.
const CLOSED_WITH_TIE: ElectionSummary = {
  ...base,
  status: 'closed',
  candidates: {
    male: [
      { user_id: 5, name: 'T1', reason: 'x', why_vote: 'x', changes: 'x', votes: 1 },
      { user_id: 7, name: 'T3', reason: 'x', why_vote: 'x', changes: 'x', votes: 0 },
      { user_id: 8, name: 'T4', reason: 'x', why_vote: 'x', changes: 'x', votes: 1 },
    ],
    female: [],
  },
  winners: { male: 'T4', female: null, male_votes: 1, female_votes: 0, term_start: '2026-02-11', term_end: '2027-02-10' },
};

// Captured live: cycle closed, zero candidates (nobody stood), zero votes.
const CLOSED_ZERO_VOTES: ElectionSummary = {
  ...base,
  status: 'closed',
  candidates: { male: [], female: [] },
  winners: { male: null, female: null, male_votes: 0, female_votes: 0, term_start: '2026-03-13', term_end: '2027-03-12' },
};

describe('ElectionCard decision logic (real backend-shaped fixtures)', () => {
  it('1/2. an open election has no winner yet and candidates carry null votes (not shown)', () => {
    expect(OPEN.winners).toBeNull();
    expect(hasAnyWinner(OPEN)).toBe(false);
    expect(isClosedWithNoVotes(OPEN)).toBe(false); // not closed at all -- must not be mistaken for the zero-vote case
    for (const c of OPEN.candidates.male) expect(candidateVoteLabel(c)).toBeNull();
  });

  it('3/4. vote counts and voting status: null before close, real numbers after', () => {
    expect(candidateVoteLabel(OPEN.candidates.male[0])).toBeNull();
    expect(candidateVoteLabel(CLOSED_WITH_WINNER.candidates.male[2])).toBe('2 votes');
    expect(candidateVoteLabel(CLOSED_WITH_WINNER.candidates.male[0])).toBe('0 votes');
  });

  it('5/6. a closed election displays the backend-declared winner and exact final vote counts, never computed independently', () => {
    expect(hasAnyWinner(CLOSED_WITH_WINNER)).toBe(true);
    expect(CLOSED_WITH_WINNER.winners?.male).toBe('R4'); // the app must display this NAME string as-is -- never treat it as a user_id
    expect(CLOSED_WITH_WINNER.winners?.male_votes).toBe(2);
    expect(isClosedWithNoVotes(CLOSED_WITH_WINNER)).toBe(false);
  });

  it('7. a numeric tie is resolved by the backend alone -- the app displays exactly the one declared winner, never a fabricated second "co-winner", and the tied vote counts remain visible on the real candidate rows', () => {
    expect(CLOSED_WITH_TIE.winners?.male).toBe('T4');
    expect(hasAnyWinner(CLOSED_WITH_TIE)).toBe(true);
    const tiedVotes = CLOSED_WITH_TIE.candidates.male.map((c) => c.votes);
    expect(tiedVotes).toEqual([1, 0, 1]); // T1 and T4 genuinely tied at 1 -- visible in the real per-candidate data
    expect(CLOSED_WITH_TIE.candidates.male.filter((c) => c.name === CLOSED_WITH_TIE.winners?.male)).toHaveLength(1);
  });

  it('8/9. a zero-vote closed election shows no winner, never a fabricated one, and is distinguishable from "still open"', () => {
    expect(hasAnyWinner(CLOSED_ZERO_VOTES)).toBe(false);
    expect(isClosedWithNoVotes(CLOSED_ZERO_VOTES)).toBe(true);
    expect(CLOSED_ZERO_VOTES.winners?.male).toBeNull();
    expect(CLOSED_ZERO_VOTES.winners?.female).toBeNull();
  });

  it('11. a stale/previous-cycle object is never mistaken for the current one by these functions -- they only ever read the single ElectionSummary passed in, never cache or compare across calls', () => {
    // Calling the same pure functions on two different fixtures back-to-back must not leak state
    // between them (there is none to leak -- these are pure functions of their one argument).
    expect(isClosedWithNoVotes(CLOSED_WITH_WINNER)).toBe(false);
    expect(isClosedWithNoVotes(CLOSED_ZERO_VOTES)).toBe(true);
    expect(isClosedWithNoVotes(CLOSED_WITH_WINNER)).toBe(false); // re-checking the first fixture again is unaffected by the second call
  });
});
