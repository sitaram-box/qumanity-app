/**
 * Pure, unit-testable decision logic for the Q-Punch election display (2026-11-08, Phase 3).
 * Deliberately has ZERO React/React Native/Expo imports, so it can be tested under plain vitest
 * without needing a component-rendering test environment (none is installed in this project).
 *
 * The backend (election_core.election_summary()) is the ONLY source of truth for these facts;
 * this module never recomputes a winner or detects a "tie" independently. `winners.male`/
 * `.female` are WINNER NAMES (strings), never user ids -- election_summary()'s own
 * `names.get(...)` call is what resolves the id to a name server-side; the app only ever
 * displays that string as-is. A "tie" is resolved entirely inside the backend's own
 * `_ensure_tallied()` (ORDER BY votes DESC, MIN(id) ASC, unchanged, protected) before this
 * response is ever built -- there is no separate backend-declared "this was a tie" signal to
 * surface, so this module does not invent one; the full per-candidate vote counts (shown once
 * closed) already let a viewer see for themselves if two candidates' `votes` are numerically
 * equal.
 */
import type { ElectionCandidate, ElectionSummary } from '@/api/qumanity';

export function hasAnyWinner(election: ElectionSummary): boolean {
  return !!election.winners && (election.winners.male !== null || election.winners.female !== null);
}

export function isClosedWithNoVotes(election: ElectionSummary): boolean {
  return election.status === 'closed' && !!election.winners && election.winners.male === null && election.winners.female === null;
}

/** Whether to show a vote count at all for this candidate -- the backend itself withholds
 * `votes` (sets it to null) until the cycle closes; the app only ever reflects that choice. */
export function candidateVoteLabel(candidate: ElectionCandidate): string | null {
  return candidate.votes === null ? null : `${candidate.votes} votes`;
}
