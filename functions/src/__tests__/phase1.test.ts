import { describe, expect, it } from 'vitest';
import type { LocationDoc } from '../../../shared/src';
import { birthLocationProblem, buildChain, presentLocationProblem } from '../chain';
import { checkPin, hashPin } from '../pinHash';

const loc = (id: string, level: LocationDoc['level'], parent: string | null, group?: string, has_children = true): LocationDoc => ({
  id, name: id, level, parent_id: parent, country_id: null, label: null, has_children, ...(group ? { group_id: group } : {}),
});

// Nepal: no zone group; village is a Ward.
const nepalPath: LocationDoc[] = [
  loc('NP.BA.1.1.1', 'village', 'NP.BA.1.1', '100000001', false),
  loc('NP.BA.1.1', 'tehsil', 'NP.BA.1', '100000002'),
  loc('NP.BA.1', 'district', 'NP.BA', '100000003'),
  loc('NP.BA', 'state', 'NPL/NP', '100000004'),
  loc('NPL/NP', 'zone', 'O_AS_NPL'),
  loc('O_AS_NPL', 'country', 'O_AS', '100000006'),
  loc('O_AS', 'continent', 'O', '100000007'),
  loc('O', 'earth', null, '100000008'),
];

describe('buildChain', () => {
  it('collects every group on the way to Earth, skipping hidden tiers', () => {
    const r = buildChain(nepalPath);
    expect(r.countryId).toBe('O_AS_NPL');
    expect(r.missing).toEqual([]);
    expect(r.chain).toEqual({
      village: '100000001', tehsil: '100000002', district: '100000003', state: '100000004',
      country: '100000006', continent: '100000007', earth: '100000008',
    });
  });

  it('reports groups not yet created', () => {
    const r = buildChain(nepalPath.map((l) => (l.level === 'district' ? { ...l, group_id: undefined } : l)));
    expect(r.missing).toEqual(['district']);
  });
});

describe('location checks', () => {
  it('present must be a Sub-continent village', () => {
    expect(presentLocationProblem(nepalPath[0], 'O_AS_NPL')).toBeNull();
    expect(presentLocationProblem(nepalPath[1], 'O_AS_NPL')).toMatch(/village/);
    expect(presentLocationProblem(loc('O_EU_FRA', 'country', 'O_EU', undefined, false), 'O_EU_FRA')).toMatch(/Sub-continent/);
  });

  it('birth may be any country abroad', () => {
    expect(birthLocationProblem(loc('O_EU_FRA', 'country', 'O_EU'), 'O_EU_FRA')).toBeNull();
    expect(birthLocationProblem(nepalPath[2], 'O_AS_NPL')).toMatch(/village/);
  });
});

describe('PIN hashing', () => {
  it('verifies the right PIN only, with unique salts', async () => {
    const a = await hashPin('48291');
    const b = await hashPin('48291');
    expect(a.salt).not.toBe(b.salt);
    expect(await checkPin('48291', a)).toBe(true);
    expect(await checkPin('48290', a)).toBe(false);
  });
});
