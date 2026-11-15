import { describe, expect, it } from 'vitest';
import { addOptions } from '../familyAdd.logic';

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
