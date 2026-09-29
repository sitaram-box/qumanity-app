/**
 * Location API for the registration wizard, built on the website's own
 * endpoints so app and website always use the same place ids:
 *   /api/world-data               continents → 229 countries
 *   /api/subcontinent             the 10 Sub-continent countries → zones → states (+ tier labels)
 *   /api/subcontinent/districts   states → districts → tehsils
 *   /api/india-villages/<id>      villages of a tehsil (or of a district without tehsils)
 * Tiers a country does not have (label null, e.g. Nepal's single zone) are
 * passed through automatically.
 */

import { api } from './client';
import type { LocationStruct, PlaceNode } from './qumanity';

export type Tier = 'continent' | 'country' | 'zone' | 'state' | 'district' | 'tehsil' | 'village';
const ORDER: Tier[] = ['continent', 'country', 'zone', 'state', 'district', 'tehsil', 'village'];

export interface Place {
  tier: Tier;
  id: string;
  name: string;
  /** Local name of this tier, e.g. "Ward" in Nepal; null = hidden tier. */
  label: string | null;
  /** The node as the website sent it (nested lists removed) — goes into the registration payload. */
  node: PlaceNode;
  countryCode?: string;
  /** Parent id where the website's data is keyed by it (districts → their state). */
  parentId?: string;
}

interface WorldData {
  continents: { id: string; code: string; name: string; countries: { id: string; code: string; name: string }[] }[];
}
interface SubCountry {
  id: string;
  code: string;
  name: string;
  labels: Record<'zone' | 'state' | 'district' | 'tehsil' | 'village', string | null>;
  zones: { id: string; name: string; states: { id: string; name: string }[] }[];
}
interface Districts {
  states: Record<string, { districts: { id: string; name: string; direct_villages?: number; tehsils: { id: string; name: string }[] }[] }>;
}

let world: Promise<WorldData> | null = null;
let sub: Promise<{ countries: SubCountry[] }> | null = null;
let districts: Promise<Districts> | null = null;

const loadWorld = () => (world ??= api<WorldData>('/api/world-data', { timeoutMs: 60_000 }));
const loadSub = () => (sub ??= api<{ countries: SubCountry[] }>('/api/subcontinent', { timeoutMs: 60_000 }));
const loadDistricts = () => (districts ??= api<Districts>('/api/subcontinent/districts', { timeoutMs: 90_000 }));

export const SUBCONTINENT_IDS = ['O_AS_IND', 'O_AS_NPL', 'O_AS_BTN', 'O_AS_BGD', 'O_AS_MMR', 'O_AS_LKA', 'O_AS_PAK', 'O_AS_BLC', 'O_AS_AFG', 'O_AS_MDV'];

function strip(n: Record<string, unknown>): PlaceNode {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(n)) if (!Array.isArray(v) && (typeof v !== 'object' || v === null)) out[k] = v;
  return out as PlaceNode;
}

function place(tier: Tier, n: Record<string, unknown>, label: string | null, countryCode?: string): Place {
  return { tier, id: String(n.id), name: String(n.name), label, node: strip(n), countryCode };
}

async function subCountry(code: string | undefined): Promise<SubCountry | undefined> {
  return (await loadSub()).countries.find((c) => c.code === code);
}

/** Children of a place (null = the top of the tree). `onlySubcontinent` limits countries to the 10. */
export async function childrenOf(parent: Place | null, onlySubcontinent = false): Promise<Place[]> {
  if (!parent) {
    if (onlySubcontinent) {
      const asia = (await loadWorld()).continents.find((c) => c.id === 'O_AS')!;
      return [place('continent', asia, 'Continent')];
    }
    return (await loadWorld()).continents.map((c) => place('continent', c, 'Continent'));
  }
  const cc = parent.countryCode;
  switch (parent.tier) {
    case 'continent': {
      const c = (await loadWorld()).continents.find((x) => x.id === parent.id);
      const list = (c?.countries ?? []).filter((k) => !onlySubcontinent || SUBCONTINENT_IDS.includes(k.id));
      return list.map((k) => place('country', k, 'Country', k.code));
    }
    case 'country': {
      const c = await subCountry(cc);
      return (c?.zones ?? []).map((z) => place('zone', z, c!.labels.zone, cc));
    }
    case 'zone': {
      const c = await subCountry(cc);
      const z = c?.zones.find((x) => x.id === parent.id);
      return (z?.states ?? []).map((s) => place('state', s, c!.labels.state, cc));
    }
    case 'state': {
      const c = await subCountry(cc);
      const ds = (await loadDistricts()).states[parent.id]?.districts ?? [];
      return ds.map((d) => ({ ...place('district', d, c?.labels.district ?? 'District', cc), parentId: parent.id }));
    }
    case 'district': {
      const c = await subCountry(cc);
      const d = (await loadDistricts()).states[parent.parentId ?? '']?.districts.find((x) => x.id === parent.id);
      if (d && d.tehsils.length) return d.tehsils.map((t) => place('tehsil', t, c?.labels.tehsil ?? 'Tehsil', cc));
      return villages(parent.id, c?.labels.village ?? 'Village', cc);
    }
    case 'tehsil': {
      const c = await subCountry(cc);
      return villages(parent.id, c?.labels.village ?? 'Village', cc);
    }
    default:
      return [];
  }
}

async function villages(parentId: string, label: string, cc?: string): Promise<Place[]> {
  const r = await api<{ villages: { id: string; name: string }[] }>(`/api/india-villages/${encodeURIComponent(parentId)}`, { timeoutMs: 30_000 });
  return r.villages.map((v) => place('village', v, label, cc));
}

/** Whether a picked path is complete: inside the Sub-continent down to the village; abroad the country. */
export function isComplete(path: Place[], leafHasChildren: boolean): boolean {
  const leaf = path[path.length - 1];
  if (!leaf) return false;
  if (leaf.tier === 'country' && !SUBCONTINENT_IDS.includes(leaf.id)) return true;
  return leaf.tier === 'village' || (!leafHasChildren && ORDER.indexOf(leaf.tier) >= ORDER.indexOf('district'));
}

/** The registration payload for a picked path: { continent, country, zone, state, … } as the website stores it. */
export function toStruct(path: Place[]): LocationStruct {
  const out: LocationStruct = {};
  for (const p of path) out[p.tier] = p.node;
  return out;
}

/** Walks down when a tier has exactly one hidden option (label null), e.g. Nepal's zone. */
export async function autoDescend(path: Place[], onlySubcontinent: boolean): Promise<Place[]> {
  let current = path;
  for (let i = 0; i < 3; i++) {
    const leaf = current[current.length - 1];
    if (!leaf || leaf.tier === 'village') return current;
    const kids = await childrenOf(leaf, onlySubcontinent);
    if (kids.length === 1 && kids[0].label === null) current = [...current, kids[0]];
    else return current;
  }
  return current;
}

