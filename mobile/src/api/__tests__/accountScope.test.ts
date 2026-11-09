import { describe, expect, it, vi } from 'vitest';

// locations.ts imports the network client; these tests never call it.
vi.mock('../client', () => ({ api: vi.fn() }));

import { excludeSubcontinent, SUBCONTINENT_IDS, type Place } from '../locations';

const country = (id: string, name: string): Place => ({ tier: 'country', id, name, label: 'Country', node: { id, name } });
const continent: Place = { tier: 'continent', id: 'O_AS', name: 'Asia', label: 'Continent', node: { id: 'O_AS', name: 'Asia' } };

describe("Account ID request: a Global member's country list", () => {
  it('drops all 10 Public Account countries and keeps every other country', () => {
    const subcontinent = SUBCONTINENT_IDS.map((id) => country(id, id));
    const others = [country('O_AS_JPN', 'Japan'), country('O_EU_FRA', 'France'), country('O_AF_KEN', 'Kenya')];
    expect(SUBCONTINENT_IDS).toHaveLength(10);
    expect(excludeSubcontinent([...subcontinent, ...others]).map((p) => p.id)).toEqual(['O_AS_JPN', 'O_EU_FRA', 'O_AF_KEN']);
  });

  it('leaves anything that is not a country untouched (continents still all shown)', () => {
    expect(excludeSubcontinent([continent])).toEqual([continent]);
  });
});
