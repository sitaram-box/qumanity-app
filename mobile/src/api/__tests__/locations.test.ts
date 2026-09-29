/**
 * The registration location tree, fed with the website's real data files
 * (Desktop/Qumanity_DPG/static/data). Skipped if that folder is not present.
 */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';

const DATA = join(homedir(), 'Desktop/Qumanity_DPG/static/data');
const has = existsSync(join(DATA, 'subcontinent_states.json'));
const read = (f: string) => JSON.parse(readFileSync(join(DATA, f), 'utf8'));

vi.mock('../client', () => ({
  api: vi.fn(async (path: string) => {
    if (path === '/api/world-data') return read('global_countries.json');
    if (path === '/api/subcontinent') return read('subcontinent_states.json');
    if (path === '/api/subcontinent/districts') return read('subcontinent_districts.json');
    if (path.startsWith('/api/india-villages/')) {
      const parent = decodeURIComponent(path.split('/').pop()!);
      return { villages: [{ id: `${parent}.1`, name: 'First Village' }] };
    }
    throw new Error(`unexpected ${path}`);
  }),
}));

describe.skipIf(!has)('location tree (website data)', () => {
  let L: typeof import('../locations');
  beforeAll(async () => {
    L = await import('../locations');
  });

  async function walk(names: string[], onlySub = false) {
    let path = await L.autoDescend([], onlySub);
    for (const n of names) {
      const kids = await L.childrenOf(path[path.length - 1] ?? null, onlySub);
      const next = kids.find((k) => k.name === n);
      if (!next) throw new Error(`${n} not in [${kids.slice(0, 8).map((k) => k.name).join(', ')}…]`);
      path = await L.autoDescend([...path, next], onlySub);
    }
    return path;
  }

  it('India: Zone → State → District → Tehsil → Village, with the website ids', async () => {
    const path = await walk(['Asia', 'India', 'Central State', 'Delhi', 'North West Delhi', 'Bawana'], true);
    expect(path.map((p) => p.tier)).toEqual(['continent', 'country', 'zone', 'state', 'district', 'tehsil']);
    expect(path.map((p) => p.id)).toEqual(['O_AS', 'O_AS_IND', 'IND/CS', 'CS.DL', 'CS.DL.5', 'CS.DL.5.4']);
    const villages = await L.childrenOf(path[5]);
    expect(villages[0]).toMatchObject({ tier: 'village', id: 'CS.DL.5.4.1', label: 'Village' });
    const full = [...path, villages[0]];
    expect(L.isComplete(full, false)).toBe(true);
    const s = L.toStruct(full);
    expect(s.state).toMatchObject({ id: 'CS.DL', name: 'Delhi' });
    expect(s.village).toEqual({ id: 'CS.DL.5.4.1', name: 'First Village' });
    expect((s.district as Record<string, unknown>).tehsils).toBeUndefined(); // nested lists are not sent
  });

  it("Nepal's single zone is passed through and local tier names are used", async () => {
    const path = await walk(['Asia', 'Nepal'], true);
    expect(path.map((p) => p.tier)).toEqual(['continent', 'country', 'zone']);
    expect(path[2].label).toBeNull();
    const states = await L.childrenOf(path[2]);
    expect(states[0].label).toBe('Province');
  });

  it('Afghanistan districts without tehsils list villages directly', async () => {
    const path = await walk(['Asia', 'Afghanistan'], true);
    const states = await L.childrenOf(path[path.length - 1]);
    const districts = await L.childrenOf(states[0]);
    const villages = await L.childrenOf(districts[0]);
    expect(villages[0].tier).toBe('village');
  });

  it('present-location picker offers only the 10 Sub-continent countries', async () => {
    const [asia] = await L.childrenOf(null, true);
    const countries = await L.childrenOf(asia, true);
    expect(countries.map((c) => c.id).sort()).toEqual([...L.SUBCONTINENT_IDS].sort());
  });

  it('a birth place abroad is complete at the country', async () => {
    const path = await walk(['Europe', 'France']);
    expect(L.isComplete(path, false)).toBe(true);
    expect(L.toStruct(path)).toMatchObject({ continent: { id: 'O_EU' }, country: { id: 'O_EU_FRA' } });
  });
});
