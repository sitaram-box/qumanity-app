/**
 * "Whole tree" layout: the family around one person, built from the website's
 * /api/family/person/<id>/cascade (for that person, plus their spouse's for the in-laws) and laid
 * out as four rows of boxes and connecting lines for an SVG canvas. Free of React / React Native
 * imports so it can be unit-tested under plain vitest (same reason as pin.logic.ts).
 *
 * Rows, top to bottom:
 *   1. Grandparents — the person's paternal + maternal units, then the spouse's.
 *   2. Parents      — the person's parents, then the spouse's.
 *   3. The person's siblings, the person ♥ spouse, the spouse's siblings.
 *   4. Children     — unmarried children, then married children's couples.
 * Lines: a grandparents' unit → the father or mother it belongs to (the website tags each
 * paternal / maternal); a parents' unit → each of their children in row 3; the person's couple →
 * each child. A married child's line goes to their couple (the cascade doesn't say which founder
 * is the child, so it never guesses).
 */

export interface TreePerson {
  id: number;
  name: string;
  is_deceased: boolean;
  is_viewer: boolean;
  relationship_to_viewer?: string | null;
  /** Used to place the centre person among their siblings (website sends siblings eldest first). */
  age_years?: number | null;
  /** A family admin's manual order among siblings (0 = eldest); website 7567c2f. */
  birth_order?: number | null;
}
interface Couple {
  husband: TreePerson | null;
  wife: TreePerson | null;
}
export interface CascadeLike {
  node: TreePerson;
  parents: { father: TreePerson | null; mother: TreePerson | null } | null;
  siblings: TreePerson[];
  grandparent_groups: (Couple & { side: 'paternal' | 'maternal' })[];
  spouse: TreePerson | null;
  children: TreePerson[];
  child_groups: Couple[];
}

export const BOX_W = 108;
export const BOX_H = 58;
const PARTNER_GAP = 16; // between spouses (the ♥ sits in it)
const ITEM_GAP = 18; // between neighbours in a row
const ROW_GAP = 64; // vertical room for the lines
const PAD = 24;

export interface TreeBox {
  key: string;
  x: number;
  y: number;
  person: TreePerson;
  /** Where the website has no relationship label (it doesn't name in-laws): "Priya's mother",
   * "Mohan's spouse". Never for a married child's couple (which founder is the child isn't known). */
  hint?: string;
}
export interface TreeLink {
  key: string;
  d: string; // SVG path
}
export interface TreeLayout {
  width: number;
  height: number;
  boxes: TreeBox[];
  links: TreeLink[];
  hearts: { key: string; x: number; y: number }[];
  /** Where the centre person's box is, so the view can start there. */
  focus: { x: number; y: number };
}

/** A row item: one person, or a couple (one or two boxes side by side). */
type Item = { id: string; people: TreePerson[]; hint?: (p: TreePerson) => string | undefined };

const coupleItem = (id: string, c: Couple | null | undefined): Item | null => {
  const people = [c?.husband, c?.wife].filter((p): p is TreePerson => !!p);
  return people.length ? { id, people } : null;
};
const itemWidth = (it: Item) => it.people.length * BOX_W + (it.people.length - 1) * PARTNER_GAP;

/**
 * Where the centre person stands among their siblings (0 = eldest), left to right. The website
 * sends the siblings eldest first but leaves the centre person out of that list, so this counts
 * the siblings the website would put before them, using its own order (family_core
 * _sort_people_by_birth): anyone with a known date of birth comes first, oldest first; then the
 * order a family admin set (birth_order); then everyone else. Ages stand in for dates of birth.
 */
export function centreIndex(me: Pick<CascadeLike, 'node' | 'siblings'>): number {
  const c = me.node;
  const before = (s: TreePerson): boolean => {
    if (s.age_years != null && c.age_years != null) return s.age_years >= c.age_years;
    if (s.age_years != null || c.age_years != null) return s.age_years != null; // a known age comes first
    if (s.birth_order != null && c.birth_order != null) return s.birth_order < c.birth_order;
    if (s.birth_order != null || c.birth_order != null) return s.birth_order != null; // a set order comes next
    return true; // neither known: keep the centre person after
  };
  return me.siblings.filter(before).length;
}

export function layoutWholeTree(me: CascadeLike, spouseSide: CascadeLike | null, centreAt?: number): TreeLayout {
  const gp = (c: CascadeLike | null, side: 'paternal' | 'maternal', who: string) =>
    coupleItem(`gp-${who}-${side}`, c?.grandparent_groups.find((g) => g.side === side));
  const parentsOf = (c: CascadeLike | null, who: string) =>
    c?.parents ? coupleItem(`p-${who}`, { husband: c.parents.father, wife: c.parents.mother }) : null;
  const spouse = me.spouse;
  const sp = spouse ? spouseSide : null;
  const spouseFirst = spouse ? shortName(spouse.name) : '';
  const centreFirst = shortName(me.node.name);
  const spParents = parentsOf(sp, 'sp');
  if (spParents && sp?.parents)
    spParents.hint = (p) => (p.id === sp.parents?.father?.id ? `${spouseFirst}'s father` : p.id === sp.parents?.mother?.id ? `${spouseFirst}'s mother` : undefined);

  const rows: Item[][] = [
    [gp(me, 'paternal', 'me'), gp(me, 'maternal', 'me'), gp(sp, 'paternal', 'sp'), gp(sp, 'maternal', 'sp')].filter((x): x is Item => !!x),
    [parentsOf(me, 'me'), spParents].filter((x): x is Item => !!x),
    (() => {
      // The centre person's siblings eldest first (left), with the centre couple in its place.
      const sibs: Item[] = me.siblings.map((p) => ({ id: `sib-me-${p.id}`, people: [p] }));
      const at = Math.max(0, Math.min(sibs.length, centreAt ?? centreIndex(me)));
      const core: Item = {
        id: 'core',
        people: spouse ? [me.node, spouse] : [me.node],
        hint: (p: TreePerson) => (p.id === spouse?.id ? `${centreFirst}'s spouse` : undefined),
      };
      return [
        ...sibs.slice(0, at),
        core,
        ...sibs.slice(at),
        ...(sp?.siblings ?? []).map((p) => ({ id: `sib-sp-${p.id}`, people: [p], hint: () => `${spouseFirst}'s sibling` })),
      ];
    })(),
    [
      ...me.children.map((p) => ({ id: `ch-${p.id}`, people: [p], hint: () => `${centreFirst}'s child` })),
      ...me.child_groups.map((g, i) => coupleItem(`cg-${i}`, g)).filter((x): x is Item => !!x),
    ],
  ].filter((r) => r.length > 0);

  const rowWidth = (r: Item[]) => r.reduce((w, it) => w + itemWidth(it), 0) + (r.length - 1) * ITEM_GAP;
  const width = Math.max(...rows.map(rowWidth)) + PAD * 2;
  const height = rows.length * BOX_H + (rows.length - 1) * ROW_GAP + PAD * 2;

  const boxes: TreeBox[] = [];
  const hearts: TreeLayout['hearts'] = [];
  // Anchors: an item's top / bottom centre, and each person's own top centre (for grandparent lines).
  const itemTop = new Map<string, { x: number; y: number }>();
  const itemBottom = new Map<string, { x: number; y: number }>();
  const personTop = new Map<string, { x: number; y: number }>(); // key: `${itemId}:${personId}`

  rows.forEach((row, r) => {
    const y = PAD + r * (BOX_H + ROW_GAP);
    let x = (width - rowWidth(row)) / 2;
    for (const it of row) {
      const w = itemWidth(it);
      it.people.forEach((p, i) => {
        const bx = x + i * (BOX_W + PARTNER_GAP);
        const hint = p.relationship_to_viewer ? undefined : it.hint?.(p);
        boxes.push({ key: `${it.id}:${p.id}`, x: bx, y, person: p, ...(hint ? { hint } : {}) });
        personTop.set(`${it.id}:${p.id}`, { x: bx + BOX_W / 2, y });
      });
      if (it.people.length === 2) hearts.push({ key: it.id, x: x + BOX_W + PARTNER_GAP / 2, y: y + BOX_H / 2 });
      itemTop.set(it.id, { x: x + w / 2, y });
      itemBottom.set(it.id, { x: x + w / 2, y: y + BOX_H });
      x += w + ITEM_GAP;
    }
  });

  const links: TreeLink[] = [];
  // `at` = how far down the gap the horizontal part of the line runs. The spouse's family uses a
  // different height from the centre person's, so when the couple sits among the centre person's
  // siblings the two families' lines don't merge into one bar.
  const link = (fromItem: string, to: { x: number; y: number } | undefined, key: string, at = 0.5) => {
    const a = itemBottom.get(fromItem);
    if (!a || !to) return;
    const mid = a.y + (to.y - a.y) * at;
    links.push({ key, d: `M${a.x} ${a.y} V${mid} H${to.x} V${to.y}` });
  };
  const to = (itemId: string, personId?: number) =>
    (personId !== undefined && personTop.get(`${itemId}:${personId}`)) || itemTop.get(itemId);

  for (const [c, who] of [[me, 'me'], [sp, 'sp']] as const) {
    if (!c) continue;
    const centre = who === 'me' ? me.node : spouse!;
    const at = who === 'me' ? 0.35 : 0.7;
    // Grandparents → the father (paternal) or mother (maternal) in the parents' couple.
    link(`gp-${who}-paternal`, to(`p-${who}`, c.parents?.father?.id), `l-gp-${who}-p`, at);
    link(`gp-${who}-maternal`, to(`p-${who}`, c.parents?.mother?.id), `l-gp-${who}-m`, at);
    // Parents → each child of theirs in row 3 (siblings and the centre person).
    for (const s of c.siblings) link(`p-${who}`, to(`sib-${who}-${s.id}`), `l-p-${who}-${s.id}`, at);
    link(`p-${who}`, to('core', centre.id), `l-p-${who}-core`, at);
  }
  // The couple → each child.
  for (const ch of me.children) link('core', to(`ch-${ch.id}`), `l-ch-${ch.id}`);
  me.child_groups.forEach((_, i) => link('core', to(`cg-${i}`), `l-cg-${i}`));

  const focusBox = personTop.get(`core:${me.node.id}`)!;
  return { width, height, boxes, links, hearts, focus: { x: focusBox.x, y: focusBox.y + BOX_H / 2 } };
}

/** First name for the box (the full name is in the accessibility label). */
export const shortName = (name: string) => {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first.length > 12 ? `${first.slice(0, 11)}…` : first;
};
