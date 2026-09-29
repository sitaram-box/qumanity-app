import { describe, expect, it } from 'vitest';
import { planSeed, type Master } from '../seedPlan';

const master: Master = {
  name: 'Earth',
  id: 'O',
  Continents: [
    { name: 'Europe', id: 'O_EU', Countries: [{ name: 'France', id: 'O_EU_FRA', code: 'FRA' }] },
    {
      name: 'Asia',
      id: 'O_AS',
      Countries: [
        { name: 'China', id: 'O_AS_CHN', code: 'CHN', Zones: [{ name: 'X', id: 'CHN/X', States: [] }] },
        {
          name: 'India',
          id: 'O_AS_IND',
          code: 'IND',
          Zones: [
            {
              name: 'Central State',
              id: 'IND/CS',
              States: [
                {
                  name: 'Delhi',
                  id: 'CS.DL',
                  Districts: [
                    {
                      name: 'East Delhi',
                      id: 'CS.DL.5',
                      tehsils: [{ name: 'Kondli', id: 'CS.DL.5.4', villages: [{ name: 'Kondli Village', id: 'CS.DL.5.4.1' }] }],
                    },
                  ],
                },
                {
                  name: 'Sikkim',
                  id: 'CS.SK',
                  Districts: [{ name: 'Sikkim', id: 'CS.SK.1', tehsils: [{ name: 'Yoksam', id: 'CS.SK.1.1', villages: [{ name: 'Mangnam', id: 'CS.SK.1.1.1' }] }] }],
                },
              ],
            },
          ],
        },
        {
          name: 'Nepal',
          id: 'O_AS_NPL',
          code: 'NPL',
          Zones: [{ name: 'Nepal', id: 'NPL/NP', States: [{ name: 'Bagmati', id: 'NP.BA', Districts: [{ name: 'Kathmandu', id: 'NP.BA.1', tehsils: [{ name: 'KMC', id: 'NP.BA.1.1', villages: [{ name: 'Ward 1', id: 'NP.BA.1.1.1' }] }] }] }] }],
        },
      ],
    },
  ],
};

let n = 100000000;
const ids = () => String(++n);

describe('planSeed', () => {
  const plan = planSeed(master, ['CS.DL'], ids);
  const loc = (id: string) => plan.locations.find((l) => l.id === id)!;

  it('seeds world countries without children and Sub-continent tiers to tehsil', () => {
    expect(loc('O_EU_FRA')).toMatchObject({ level: 'country', has_children: false });
    expect(loc('O_AS_CHN').has_children).toBe(false);
    expect(plan.locations.find((l) => l.id === 'CHN/X')).toBeUndefined();
    expect(loc('CS.SK.1.1')).toMatchObject({ level: 'tehsil', has_children: false, label: 'Tehsil' });
    expect(loc('NP.BA.1.1')).toMatchObject({ has_children: false, label: 'Local Level' });
  });

  it('adds villages only inside the pilot', () => {
    expect(loc('CS.DL.5.4').has_children).toBe(true);
    expect(loc('CS.DL.5.4.1').level).toBe('village');
    expect(plan.locations.find((l) => l.id === 'CS.SK.1.1.1')).toBeUndefined();
    expect(plan.locations.find((l) => l.id === 'NP.BA.1.1.1')).toBeUndefined();
  });

  it('creates groups for the pilot and all its ancestors up to Earth', () => {
    const levels = plan.groups.map((g) => g.level).sort();
    expect(levels).toEqual(['continent', 'country', 'district', 'earth', 'state', 'tehsil', 'village', 'zone']);
    expect(loc('CS.SK').group_id).toBeUndefined();
    expect(loc('O_EU').group_id).toBeUndefined();
  });

  it('gives each pilot village its full chain and links parent groups', () => {
    const v = loc('CS.DL.5.4.1') as { chain?: Record<string, string> };
    expect(Object.keys(v.chain!).sort()).toEqual(['continent', 'country', 'district', 'earth', 'state', 'tehsil', 'village', 'zone']);
    const village = plan.groups.find((g) => g.level === 'village')!;
    expect(village).toMatchObject({ mode: 'open', timeline: 'public', name: 'Kondli Village Group' });
    expect(village.parent_group).toBe(loc('CS.DL.5.4').group_id);
    expect(plan.groups.find((g) => g.level === 'earth')).toMatchObject({ parent_group: null, mode: 'council', timeline: 'global' });
    expect(plan.groups.find((g) => g.level === 'district')?.mode).toBe('social_workers');
  });

  it('skips hidden tiers (Nepal has no zone group)', () => {
    const p = planSeed(master, ['NP.BA.1.1'], ids);
    expect(p.groups.find((g) => g.code === 'NPL/NP')).toBeUndefined();
    const ward = p.locations.find((l) => l.id === 'NP.BA.1.1.1') as { chain?: Record<string, string> };
    expect(ward.chain?.zone).toBeUndefined();
    expect(ward.chain?.country).toBeDefined();
  });

  it('rejects unknown pilot ids', () => {
    expect(() => planSeed(master, ['CS.XX'], ids)).toThrow(/not found/);
  });
});
