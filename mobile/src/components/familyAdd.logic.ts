/**
 * Which "Add family member" options can work for a person in the unit on screen — so the sheet only
 * offers what the website will accept. Free of React / React Native imports so it can be unit-tested
 * under plain vitest (same reason as pin.logic.ts). The server still checks everything and its own
 * message is shown if anything changed in between.
 *
 * Website rules mirrored here (family_core.py):
 *   - Child   (/person/<id>/child):   the person founds THIS unit and it has a spouse; admin of this unit.
 *   - Sibling (/person/<id>/sibling): goes into the person's BIRTH unit, which must be known; admin of
 *     that birth unit. For a founder that's their side's parents' unit; for an unmarried child, this unit.
 *   - Spouse  (/person/<id>/spouse):  the person has no active marriage; admin of a unit they belong to.
 *   - Parents (/node/<unit>/add-parents): a founder whose side has no parents' unit yet; admin of this unit.
 */

export type AddKind = 'child' | 'sibling' | 'spouse' | 'parents';
/** The person's place in the unit on screen. */
export type Role = 'husband' | 'wife' | 'child';

export interface AddOption {
  kind: AddKind;
  label: string;
  /** child: the unit the new child joins (this one). parents: the unit to grow (this one). */
  groupId?: number;
  /** parents: which founder's parents. */
  side?: 'husband' | 'wife';
}

export interface UnitLike {
  group_id: number;
  husband: { id: number } | null;
  wife: { id: number } | null;
  parent_groups: { group_id: number; side?: 'husband' | 'wife' }[];
}

export const ADD_LABEL: Record<AddKind, string> = { child: 'Child', sibling: 'Sibling', spouse: 'Spouse', parents: 'Parents' };

export function addOptions(role: Role, unit: UnitLike, adminOf: (groupId: number) => boolean): AddOption[] {
  const out: AddOption[] = [];
  const here = adminOf(unit.group_id);
  if (role === 'child') {
    // An unmarried child's birth unit is this unit; they have no spouse (so no children) yet.
    if (here) out.push({ kind: 'sibling', label: ADD_LABEL.sibling });
    if (here) out.push({ kind: 'spouse', label: ADD_LABEL.spouse });
    return out;
  }
  const partner = role === 'husband' ? unit.wife : unit.husband;
  const parentsUnit = unit.parent_groups.find((p) => p.side === role);
  if (partner && here) out.push({ kind: 'child', label: ADD_LABEL.child, groupId: unit.group_id });
  if (parentsUnit && adminOf(parentsUnit.group_id)) out.push({ kind: 'sibling', label: ADD_LABEL.sibling });
  if (!partner && here) out.push({ kind: 'spouse', label: ADD_LABEL.spouse });
  if (!parentsUnit && here) out.push({ kind: 'parents', label: ADD_LABEL.parents, groupId: unit.group_id, side: role });
  return out;
}

// ---- 2026-11-18: the person sheet's View links, linking someone already on Qumanity, and
// sibling order (website e8b85e7). ----

/** What the website's cascade says about a person — the fields these helpers read. */
export interface CascadeLike {
  birth_group_id: number | null;
  siblings: unknown[];
  marital_group_id: number | null;
  spouse: unknown | null;
  children: unknown[];
  child_groups: unknown[];
}

export interface ViewLink {
  kind: 'spouse' | 'children' | 'siblings';
  label: string;
  /** The family unit to open: the couple's unit (spouse, children) or the birth unit (siblings). */
  groupId: number;
}

/** "View Spouse / Children / Siblings" for relationships that already exist. */
export function viewLinks(c: CascadeLike | null): ViewLink[] {
  if (!c) return [];
  const out: ViewLink[] = [];
  if (c.spouse && c.marital_group_id) out.push({ kind: 'spouse', label: 'View Spouse', groupId: c.marital_group_id });
  if ((c.children.length > 0 || c.child_groups.length > 0) && c.marital_group_id)
    out.push({ kind: 'children', label: 'View Children', groupId: c.marital_group_id });
  if (c.siblings.length > 0 && c.birth_group_id) out.push({ kind: 'siblings', label: 'View Siblings', groupId: c.birth_group_id });
  return out;
}

/**
 * Add options, minus what the cascade shows already exists. A spouse is one at a time: once one is
 * recorded, "View Spouse" replaces "Add Spouse". Children and siblings can be many, so "Add" stays
 * next to "View" for those.
 */
export function addOptionsWithCascade(role: Role, unit: UnitLike, adminOf: (groupId: number) => boolean, c: CascadeLike | null): AddOption[] {
  const opts = addOptions(role, unit, adminOf);
  return c?.spouse ? opts.filter((o) => o.kind !== 'spouse') : opts;
}

/** One "already on Qumanity?" match from /api/family/suggest, with what linking it sends. */
export interface RelativeMatch {
  key: string;
  name: string;
  detail: string;
  action: 'join' | 'notify';
  matched_node_id?: number;
  user_id?: number;
}

/**
 * The website's suggestions, as link choices: a person already in another family tree with no
 * account yet → 'join' (their place is reused); someone with an account (whether or not they've
 * built their tree) → 'notify' (they're asked to confirm). The website re-checks either; e.g. a
 * tree match that has since been claimed is refused with a message saying to ask them instead.
 */
export function relativeMatches(results: { type: string; [k: string]: unknown }[]): RelativeMatch[] {
  const out: RelativeMatch[] = [];
  for (const r of results) {
    if (r.type === 'group' && typeof r.matched_node_id === 'number') {
      const founders = [r.husband_name, r.wife_name].filter(Boolean).join(' & ');
      out.push({
        key: `n${r.matched_node_id}`,
        name: String(r.matched_name ?? ''),
        detail: `In the family tree “${r.group_name ?? ''}”${founders ? ` (${founders})` : ''}`,
        action: 'join',
        matched_node_id: r.matched_node_id,
      });
    } else if ((r.type === 'unactivated_user' || r.type === 'real_user') && typeof r.user_id === 'number') {
      out.push({
        key: `u${r.user_id}`,
        name: String(r.name ?? ''),
        detail: r.type === 'real_user' ? `On Qumanity${r.location ? ` · ${r.location}` : ''}` : 'On Qumanity · hasn’t built a family tree yet',
        action: 'notify',
        user_id: r.user_id,
      });
    }
  }
  return out;
}

/** Move one item up (-1) or down (+1) in a list; unchanged at either end. */
export function moveItem<T>(list: T[], index: number, dir: -1 | 1): T[] {
  const to = index + dir;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return list;
  const next = list.slice();
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}
