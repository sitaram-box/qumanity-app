import { describe, expect, it } from 'vitest';
import { BOX_H, layoutWholeTree, shortName, type CascadeLike, type TreePerson } from '../familyWholeTree.logic';

const P = (id: number, name: string, extra: Partial<TreePerson> = {}): TreePerson => ({ id, name, is_deceased: false, is_viewer: false, ...extra });

// The test family: Arjun (you) ♥ Priya; Arjun's parents Ramesh 🕊️ + Sunita with Vikram;
// Priya's parents Mohan 🕊️ + Kamla; children Kabir, Meera, Asha 🕊️.
const arjun = P(14, 'Arjun Testkumar', { is_viewer: true });
const priya = P(17, 'Priya Testkumar');
const me: CascadeLike = {
  node: arjun,
  parents: { father: P(10, 'Ramesh Testkumar', { is_deceased: true }), mother: P(11, 'Sunita Testkumar') },
  siblings: [P(30, 'Vikram Testkumar')],
  grandparent_groups: [],
  spouse: priya,
  children: [P(20, 'Kabir'), P(21, 'Meera'), P(22, 'Asha', { is_deceased: true })],
  child_groups: [],
};
const priyaSide: CascadeLike = {
  node: priya,
  parents: { father: P(40, 'Mohan Sharma', { is_deceased: true }), mother: P(41, 'Kamla Sharma') },
  siblings: [],
  grandparent_groups: [],
  spouse: arjun,
  children: [],
  child_groups: [],
};

const rowsOf = (l: ReturnType<typeof layoutWholeTree>) => {
  const ys = [...new Set(l.boxes.map((b) => b.y))].sort((a, b) => a - b);
  return ys.map((y) => l.boxes.filter((b) => b.y === y).map((b) => b.person.name.split(' ')[0]));
};

describe('Whole tree layout', () => {
  it('lays the test family out as parents / you + spouse + siblings / children', () => {
    const l = layoutWholeTree(me, priyaSide);
    expect(rowsOf(l)).toEqual([
      ['Ramesh', 'Sunita', 'Mohan', 'Kamla'],
      ['Vikram', 'Arjun', 'Priya'],
      ['Kabir', 'Meera', 'Asha'],
    ]);
    expect(l.hearts).toHaveLength(3); // Ramesh♥Sunita, Mohan♥Kamla, Arjun♥Priya
  });

  it('draws a line from each parents unit to each of its children, and from the couple to each child', () => {
    const keys = layoutWholeTree(me, priyaSide).links.map((x) => x.key).sort();
    expect(keys).toEqual(['l-ch-20', 'l-ch-21', 'l-ch-22', 'l-p-me-30', 'l-p-me-core', 'l-p-sp-core'].sort());
  });

  it("a parents' line ends at that person's own box (Priya's parents → Priya, not Arjun)", () => {
    const l = layoutWholeTree(me, priyaSide);
    const priyaBox = l.boxes.find((b) => b.person.id === 17)!;
    const d = l.links.find((x) => x.key === 'l-p-sp-core')!.d;
    expect(d.endsWith(`H${priyaBox.x + 54} V${priyaBox.y}`)).toBe(true);
  });

  it('grandparents link to the father (paternal) and mother (maternal) — never flattened', () => {
    const withGp: CascadeLike = {
      ...me,
      grandparent_groups: [
        { side: 'paternal', husband: P(1, 'Dada'), wife: P(2, 'Dadi') },
        { side: 'maternal', husband: P(3, 'Nana'), wife: P(4, 'Nani') },
      ],
    };
    const l = layoutWholeTree(withGp, null);
    const ramesh = l.boxes.find((b) => b.person.id === 10)!;
    const sunita = l.boxes.find((b) => b.person.id === 11)!;
    expect(l.links.find((x) => x.key === 'l-gp-me-p')!.d.endsWith(`H${ramesh.x + 54} V${ramesh.y}`)).toBe(true);
    expect(l.links.find((x) => x.key === 'l-gp-me-m')!.d.endsWith(`H${sunita.x + 54} V${sunita.y}`)).toBe(true);
  });

  it('a married child is drawn as their couple, linked from the parents', () => {
    const l = layoutWholeTree({ ...me, children: [], child_groups: [{ husband: P(20, 'Kabir'), wife: P(50, 'Neha') }] }, null);
    expect(rowsOf(l)[2]).toEqual(['Kabir', 'Neha']);
    expect(l.links.map((x) => x.key)).toContain('l-cg-0');
  });

  it('someone with no known parents, spouse or children: just their own box', () => {
    const l = layoutWholeTree({ ...me, parents: null, siblings: [], spouse: null, children: [] }, null);
    expect(rowsOf(l)).toEqual([['Arjun']]);
    expect(l.links).toEqual([]);
    expect(l.focus).toEqual({ x: l.boxes[0].x + 54, y: l.boxes[0].y + BOX_H / 2 });
  });

  it('ignores a spouse cascade when there is no spouse', () => {
    const l = layoutWholeTree({ ...me, spouse: null }, priyaSide);
    expect(l.boxes.some((b) => b.person.id === 40)).toBe(false);
  });

  it('short names: first name, long ones trimmed', () => {
    expect(shortName('Ramesh Testkumar')).toBe('Ramesh');
    expect(shortName('Bhagyalakshminarayani Rao')).toBe('Bhagyalaksh…');
  });
});

describe('Whole tree labels for in-laws', () => {
  it("names the spouse's parents and siblings by position when the website has no label", () => {
    const side = { ...priyaSide, siblings: [P(42, 'Rohan Sharma')] };
    const hints = Object.fromEntries(layoutWholeTree(me, side).boxes.map((b) => [b.person.name.split(' ')[0], b.hint]));
    expect(hints).toMatchObject({ Mohan: "Priya's father", Kamla: "Priya's mother", Rohan: "Priya's sibling" });
    expect(hints.Ramesh).toBeUndefined(); // your own side never needs one
  });

  it("the website's own label wins over the hint", () => {
    const side = { ...priyaSide, parents: { father: P(40, 'Mohan Sharma', { relationship_to_viewer: 'Father-in-law' }), mother: null } };
    expect(layoutWholeTree(me, side).boxes.find((b) => b.person.id === 40)!.hint).toBeUndefined();
  });
});

describe('Whole tree centred on someone else', () => {
  it("centred on Mohan (your father-in-law): Kamla is \"Mohan's spouse\", your couple is his married child's unit", () => {
    const mohan: CascadeLike = {
      node: P(40, 'Mohan Sharma', { is_deceased: true }),
      parents: null,
      siblings: [],
      grandparent_groups: [],
      spouse: P(41, 'Kamla Sharma'),
      children: [P(43, 'Sita Sharma')],
      child_groups: [{ husband: arjun, wife: { ...priya, relationship_to_viewer: 'Spouse' } }],
    };
    const l = layoutWholeTree(mohan, null);
    expect(rowsOf(l)).toEqual([['Mohan', 'Kamla'], ['Sita', 'Arjun', 'Priya']]);
    const hint = (id: number) => l.boxes.find((b) => b.person.id === id)!.hint;
    expect(hint(41)).toBe("Mohan's spouse");
    expect(hint(43)).toBe("Mohan's child");
    expect(hint(14)).toBeUndefined(); // in the married child's couple: no guessing
  });
});
