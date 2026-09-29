/**
 * Location tiers of the Public timeline (Indian Sub-continent, 10 countries).
 * Labels mirror TIER_LABELS in Qumanity_DPG/scripts/build_subcontinent_data.py.
 * A null label means the tier is structural only (single zone/state) — it is
 * auto-selected in pickers and gets NO group of its own.
 *
 * Tier depth cannot be derived from an id string (e.g. Balochistan village
 * BL.1.1.6 sits directly under district BL.1.1), so chains are always walked
 * through `parent_id` in the `locations` collection.
 */

export const LEVELS = ['earth', 'continent', 'country', 'zone', 'state', 'district', 'tehsil', 'village'] as const;
export type Level = (typeof LEVELS)[number];
export type SubLevel = 'zone' | 'state' | 'district' | 'tehsil' | 'village';

export type TierLabels = Record<SubLevel, string | null>;

export const EARTH_ID = 'O';
export const ASIA_ID = 'O_AS';

export const TIER_LABELS: Record<string, TierLabels> = {
  IND: { zone: 'Zone', state: 'State', district: 'District', tehsil: 'Tehsil', village: 'Village' },
  NPL: { zone: null, state: 'Province', district: 'District', tehsil: 'Local Level', village: 'Ward' },
  BTN: { zone: null, state: 'Dzongkhag', district: 'Gewog', tehsil: 'Chiwog', village: 'Village' },
  BGD: { zone: null, state: 'Division', district: 'District', tehsil: 'Upazila', village: 'Village' },
  MMR: { zone: null, state: 'State / Region', district: 'District', tehsil: 'Township', village: 'Village' },
  LKA: { zone: null, state: 'Province', district: 'District', tehsil: 'DS Division', village: 'GN Division' },
  PAK: { zone: null, state: 'Province', district: 'District', tehsil: 'Tehsil', village: 'Village' },
  BLC: { zone: null, state: null, district: 'District', tehsil: 'Tehsil', village: 'Village' },
  AFG: { zone: null, state: 'Province', district: 'District', tehsil: null, village: 'Village' },
  MDV: { zone: null, state: null, district: 'Atoll', tehsil: 'Area', village: 'Island' },
};

export const SUBCONTINENT_COUNTRIES: Record<string, { id: string; name: string }> = {
  IND: { id: 'O_AS_IND', name: 'India' },
  NPL: { id: 'O_AS_NPL', name: 'Nepal' },
  BTN: { id: 'O_AS_BTN', name: 'Bhutan' },
  BGD: { id: 'O_AS_BGD', name: 'Bangladesh' },
  MMR: { id: 'O_AS_MMR', name: 'Myanmar' },
  LKA: { id: 'O_AS_LKA', name: 'Sri Lanka' },
  PAK: { id: 'O_AS_PAK', name: 'Pakistan' },
  BLC: { id: 'O_AS_BLC', name: 'Balochistan' },
  AFG: { id: 'O_AS_AFG', name: 'Afghanistan' },
  MDV: { id: 'O_AS_MDV', name: 'Maldives' },
};

export const SUBCONTINENT_COUNTRY_IDS: readonly string[] = Object.values(SUBCONTINENT_COUNTRIES).map((c) => c.id);

export function isSubcontinentCountry(countryId: string): boolean {
  return SUBCONTINENT_COUNTRY_IDS.includes(countryId);
}

/** Country code (e.g. "IND") from a country id ("O_AS_IND"). */
export function countryCodeOf(countryId: string): string {
  return countryId.split('_').pop() ?? '';
}

export function tierLabel(countryCode: string, level: Level): string | null {
  if (level === 'earth') return 'Earth';
  if (level === 'continent') return 'Continent';
  if (level === 'country') return 'Country';
  return TIER_LABELS[countryCode]?.[level] ?? null;
}

/** Firestore doc id for a location id (zone ids like "IND/CS" contain '/', which doc ids cannot). */
export function locationDocId(locationId: string): string {
  return locationId.replace(/\//g, '|');
}
