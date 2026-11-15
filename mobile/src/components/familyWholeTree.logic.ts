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

export function layoutWholeTree(me: CascadeLike, spouseSide: CascadeLike | null): TreeLayout {
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
    [
      ...me.siblings.map((p) => ({ id: `sib-me-${p.id}`, people: [p] })),
      { id: 'core', people: spouse ? [me.node, spouse] : [me.node], hint: (p: TreePerson) => (p.id === spouse?.id ? `${centreFirst}'s spouse` : undefined) },
      ...(sp?.siblings ?? []).map((p) => ({ id: `sib-sp-${p.id}`, people: [p], hint: () => `${spouseFirst}'s sibling` })),
    ],
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
  const link = (fromItem: string, to: { x: number; y: number } | undefined, key: string) => {
    const a = itemBottom.get(fromItem);
    if (!a || !to) return;
    const mid = a.y + (to.y - a.y) / 2;
    links.push({ key, d: `M${a.x} ${a.y} V${mid} H${to.x} V${to.y}` });
  };
  const to = (itemId: string, personId?: number) =>
    (personId !== undefined && personTop.get(`${itemId}:${personId}`)) || itemTop.get(itemId);

  for (const [c, who] of [[me, 'me'], [sp, 'sp']] as const) {
    if (!c) continue;
    const centre = who === 'me' ? me.node : spouse!;
    // Grandparents → the father (paternal) or mother (maternal) in the parents' couple.
    link(`gp-${who}-paternal`, to(`p-${who}`, c.parents?.father?.id), `l-gp-${who}-p`);
    link(`gp-${who}-maternal`, to(`p-${who}`, c.parents?.mother?.id), `l-gp-${who}-m`);
    // Parents → each child of theirs in row 3 (siblings and the centre person).
    for (const s of c.siblings) link(`p-${who}`, to(`sib-${who}-${s.id}`), `l-p-${who}-${s.id}`);
    link(`p-${who}`, to('core', centre.id), `l-p-${who}-core`);
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
