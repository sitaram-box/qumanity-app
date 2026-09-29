/**
 * Pure seeding planner: Desktop/0_Earth/Qumanity_Master.json → location and
 * group documents, sized for the Spark plan (20k writes/day).
 *
 *   • Earth, all continents and all countries (so birth places work anywhere)
 *   • every tier down to tehsil in the 10 Sub-continent countries
 *   • villages, and groups, only inside the PILOT areas (e.g. Delhi = "CS.DL")
 *     plus the groups of every ancestor of a pilot area, up to Earth
 *
 * has_children reflects what is seeded, so pickers never open an empty list.
 * Every group gets the owner (Mentor) in seat 1, which makes it active.
 */

import {
  countryCodeOf,
  hasGroup,
  isSubcontinentCountry,
  modeForLevel,
  publicGroupName,
  tierLabel,
  timelineForLevel,
  type Chain,
  type Level,
  type LocationDoc,
} from '../../../shared/src';

// ---- Master JSON shape (names/ids only, see memory: master holds names & ids) ----
export interface MNode { name: string; id: string }
export interface MVillageParent extends MNode { villages?: MNode[] }
export interface MDistrict extends MVillageParent { tehsils?: MVillageParent[] }
export interface MState extends MNode { Districts?: MDistrict[] }
export interface MZone extends MNode { States?: MState[] }
export interface MCountry extends MNode { code?: string; Zones?: MZone[] }
export interface MContinent extends MNode { Countries?: MCountry[] }
export interface Master extends MNode { Continents: MContinent[] }

export interface SeedGroup {
  group_id: string;
  name: string;
  timeline: 'public' | 'global';
  mode: ReturnType<typeof modeForLevel>;
  level: Level;
  code: string;
  parent_group: string | null;
}

export interface SeedPlan {
  locations: LocationDoc[];
  groups: SeedGroup[];
}

interface Node {
  id: string;
  name: string;
  level: Level;
  parent: Node | null;
  countryId: string | null;
  children: Node[];
}

/** Build the seeded tree (without pruning pilot villages yet). */
function buildTree(master: Master, inPilot: (ids: string[]) => boolean): Node {
  const earth: Node = { id: master.id, name: master.name, level: 'earth', parent: null, countryId: null, children: [] };
  const add = (parent: Node, n: MNode, level: Level, countryId: string | null): Node => {
    const node: Node = { id: n.id, name: n.name, level, parent, countryId, children: [] };
    parent.children.push(node);
    return node;
  };
  const lineage = (n: Node): string[] => {
    const ids: string[] = [];
    for (let x: Node | null = n; x; x = x.parent) ids.push(x.id);
    return ids;
  };
  const addVillages = (parent: Node, villages: MNode[] | undefined, countryId: string) => {
    if (!villages?.length || !inPilot(lineage(parent))) return;
    for (const v of villages) add(parent, v, 'village', countryId);
  };

  for (const c of master.Continents) {
    const cont = add(earth, c, 'continent', null);
    for (const k of c.Countries ?? []) {
      const country = add(cont, k, 'country', k.id);
      if (!isSubcontinentCountry(k.id)) continue;
      for (const z of k.Zones ?? []) {
        const zone = add(country, z, 'zone', k.id);
        for (const s of z.States ?? []) {
          const state = add(zone, s, 'state', k.id);
          for (const d of s.Districts ?? []) {
            const district = add(state, d, 'district', k.id);
            for (const t of d.tehsils ?? []) {
              const tehsil = add(district, t, 'tehsil', k.id);
              addVillages(tehsil, t.villages, k.id);
            }
            addVillages(district, d.villages, k.id); // places without a tehsil tier
          }
        }
      }
    }
  }
  return earth;
}

export function planSeed(master: Master, pilotIds: string[], newGroupId: () => string): SeedPlan {
  const pilots = new Set(pilotIds);
  const inPilot = (lineageIds: string[]) => lineageIds.some((id) => pilots.has(id));
  const root = buildTree(master, inPilot);

  // Which nodes get a group: inside a pilot, or an ancestor of one.
  const found = new Set<string>();
  const needsGroup = new Set<Node>();
  const walk = (n: Node, underPilot: boolean): boolean => {
    const here = underPilot || pilots.has(n.id);
    if (pilots.has(n.id)) found.add(n.id);
    let containsPilot = pilots.has(n.id);
    for (const c of n.children) containsPilot = walk(c, here) || containsPilot;
    const code = n.countryId ? countryCodeOf(n.countryId) : '';
    if ((here || containsPilot) && hasGroup(code, n.level)) needsGroup.add(n);
    return containsPilot;
  };
  walk(root, false);
  const missing = pilotIds.filter((id) => !found.has(id));
  if (missing.length) throw new Error(`Pilot area not found in the Sub-continent tree: ${missing.join(', ')}`);

  const groupOf = new Map<Node, string>();
  for (const n of needsGroup) groupOf.set(n, newGroupId());
  if (new Set(groupOf.values()).size !== groupOf.size) throw new Error('Duplicate group id generated, re-run.');

  const locations: LocationDoc[] = [];
  const groups: SeedGroup[] = [];
  const visit = (n: Node) => {
    const code = n.countryId ? countryCodeOf(n.countryId) : '';
    const doc: LocationDoc & { chain?: Chain } = {
      id: n.id,
      name: n.name,
      level: n.level,
      parent_id: n.parent?.id ?? null,
      country_id: n.countryId,
      label: tierLabel(code, n.level),
      has_children: n.children.length > 0,
    };
    const gid = groupOf.get(n);
    if (gid) {
      doc.group_id = gid;
      let parentGroup: string | null = null;
      for (let p = n.parent; p && !parentGroup; p = p.parent) parentGroup = groupOf.get(p) ?? null;
      groups.push({
        group_id: gid,
        name: publicGroupName(n.name, code, n.level),
        timeline: timelineForLevel(n.level) as 'public' | 'global',
        mode: modeForLevel(n.level),
        level: n.level,
        code: n.id,
        parent_group: parentGroup,
      });
    }
    if (n.level === 'village' && gid) {
      const chain: Chain = {};
      for (let p: Node | null = n; p; p = p.parent) {
        const g = groupOf.get(p);
        if (g) chain[p.level] = g;
      }
      doc.chain = chain;
    }
    locations.push(doc);
    n.children.forEach(visit);
  };
  visit(root);
  return { locations, groups };
}
