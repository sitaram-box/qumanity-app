import { describe, expect, it } from 'vitest';
import { addOptions, addOptionsWithCascade, moveItem, relativeMatches, viewLinks } from '../familyAdd.logic';

const kinds = (opts: { kind: string }[]) => opts.map((o) => o.kind);
const admin = (...ids: number[]) => (gid: number) => ids.includes(gid);

// Unit 7: Arjun (husband) + Priya (wife), Arjun's parents' unit 6 is known; Priya's isn't.
const unit = { group_id: 7, husband: { id: 14 }, wife: { id: 17 }, parent_groups: [{ group_id: 6, side: 'husband' as const }] };

describe('Add family member: only options the website will accept', () => {
  it('a founder with a spouse and known parents: Child + Sibling (no Spouse, no Parents)', () => {
    expect(kinds(addOptions('husband', unit, admin(7, 6)))).toEqual(['child', 'sibling']);
  });

  it('the other founder, whose parents are not known yet: Child + Parents (no Sibling)', () => {
    const opts = addOptions('wife', unit, admin(7, 6));
    expect(kinds(opts)).toEqual(['child', 'parents']);
    expect(opts.find((o) => o.kind === 'parents')).toMatchObject({ groupId: 7, side: 'wife' });
  });

  it('Child is added to the unit on screen (group_id), never guessed', () => {
    expect(addOptions('husband', unit, admin(7, 6)).find((o) => o.kind === 'child')).toMatchObject({ groupId: 7 });
  });

  it('Sibling needs admin of the BIRTH unit, not just this one', () => {
    expect(kinds(addOptions('husband', unit, admin(7)))).toEqual(['child']);
  });

  it('a founder with no spouse recorded: Spouse instead of Child', () => {
    const single = { ...unit, wife: null };
    expect(kinds(addOptions('husband', single, admin(7, 6)))).toEqual(['sibling', 'spouse']);
  });

  it('an unmarried child: Sibling + Spouse (never Child or Parents)', () => {
    expect(kinds(addOptions('child', unit, admin(7)))).toEqual(['sibling', 'spouse']);
  });

  it('not an admin anywhere: nothing to offer', () => {
    expect(addOptions('husband', unit, admin())).toEqual([]);
    expect(addOptions('child', unit, admin())).toEqual([]);
  });
});


const cascade = (over: Partial<Parameters<typeof viewLinks>[0] & object> = {}) => ({
  birth_group_id: 6,
  siblings: [],
  marital_group_id: null,
  spouse: null,
  children: [],
  child_groups: [],
  ...over,
});

describe('Person sheet: View links from the cascade', () => {
  it('nothing recorded yet: no View links', () => {
    expect(viewLinks(cascade())).toEqual([]);
    expect(viewLinks(null)).toEqual([]);
  });
  it('spouse and children open the couple’s unit; siblings open the birth unit', () => {
    const links = viewLinks(cascade({ spouse: {}, marital_group_id: 7, children: [{}], siblings: [{}] }));
    expect(links.map((l) => [l.kind, l.groupId])).toEqual([
      ['spouse', 7],
      ['children', 7],
      ['siblings', 6],
    ]);
  });
  it('a married child (only in child_groups) still counts as children', () => {
    expect(viewLinks(cascade({ spouse: {}, marital_group_id: 7, child_groups: [{}] })).map((l) => l.kind)).toContain('children');
  });
  it('a spouse already recorded removes Add Spouse; Add Sibling stays (siblings can be many)', () => {
    const kinds = (c: ReturnType<typeof cascade>) => addOptionsWithCascade('child', unit, admin(7), c).map((o) => o.kind);
    expect(kinds(cascade())).toEqual(['sibling', 'spouse']);
    expect(kinds(cascade({ spouse: {}, marital_group_id: 9 }))).toEqual(['sibling']);
  });
});

describe('Add flow: someone already on Qumanity', () => {
  it('a placeholder in another tree → join; an account → notify; other kinds ignored', () => {
    const m = relativeMatches([
      { type: 'group', matched_node_id: 41, matched_name: 'Kamla Sharma', group_name: 'MOMA-KAMA-Sharma Family', husband_name: 'Mohan', wife_name: 'Kamla' },
      { type: 'unactivated_user', user_id: 900, name: 'Kamla S' },
      { type: 'real_user', user_id: 901, name: 'Kamla Devi', location: 'Bawana, Delhi' },
      { type: 'none' },
    ]);
    expect(m.map((x) => [x.action, x.matched_node_id ?? x.user_id])).toEqual([
      ['join', 41],
      ['notify', 900],
      ['notify', 901],
    ]);
    expect(m[0].detail).toContain('Mohan & Kamla');
    expect(m[2].detail).toBe('On Qumanity · Bawana, Delhi');
  });
});

describe('Sibling order', () => {
  it('moves one place up or down, never past either end', () => {
    expect(moveItem(['a', 'b', 'c'], 2, -1)).toEqual(['a', 'c', 'b']);
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});
