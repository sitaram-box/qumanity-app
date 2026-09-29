/** Pure helpers for walking a location up to Earth and building the group chain. */

import {
  countryCodeOf,
  hasGroup,
  isSubcontinentCountry,
  type Chain,
  type LocationDoc,
} from '../../shared/src';

export interface ChainResult {
  chain: Chain;
  /** Levels that should have a group but none exists yet (or it is not seeded). */
  missing: string[];
  countryId: string | null;
}

/** `path` is ordered leaf → root (village … earth), as read via parent_id. */
export function buildChain(path: readonly LocationDoc[]): ChainResult {
  const countryId = path.find((l) => l.level === 'country')?.id ?? null;
  const code = countryId ? countryCodeOf(countryId) : '';
  const chain: Chain = {};
  const missing: string[] = [];
  for (const loc of path) {
    if (!hasGroup(code, loc.level)) continue;
    if (loc.group_id) chain[loc.level] = loc.group_id;
    else missing.push(loc.level);
  }
  return { chain, missing, countryId };
}

export type PlaceProblem = string | null;

/** Present location: a leaf (village-level) place inside the 10 Sub-continent countries. */
export function presentLocationProblem(leaf: LocationDoc | undefined, countryId: string | null): PlaceProblem {
  if (!leaf) return 'Present location not found.';
  if (!countryId || !isSubcontinentCountry(countryId)) {
    return 'Present location must be in one of the 10 Indian Sub-continent countries.';
  }
  if (leaf.has_children) return 'Choose your present location down to the village.';
  return null;
}

/** Birth location: anywhere on Earth — to village inside the Sub-continent, country elsewhere. */
export function birthLocationProblem(leaf: LocationDoc | undefined, countryId: string | null): PlaceProblem {
  if (!leaf) return 'Birth location not found.';
  if (!countryId) return 'Choose at least your birth country.';
  if (isSubcontinentCountry(countryId) && leaf.has_children) return 'Choose your birth location down to the village.';
  return null;
}
