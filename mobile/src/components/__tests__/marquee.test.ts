/** The marquee cuts poems into short segments (one huge line of text renders blank on Android). */

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/api/qumanity', () => ({}));
vi.mock('@/state/app', () => ({ useApp: () => ({}) }));
vi.mock('expo-secure-store', () => ({}));
vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('react-native', () => ({
  Animated: {},
  Modal: () => null,
  Platform: { OS: 'web' },
  Pressable: () => null,
  StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
  Text: () => null,
  TouchableOpacity: () => null,
  View: () => null,
}));

const FILE = join(homedir(), 'Desktop/Qumanity_DPG/Poems/poems_hindi.json');

describe.skipIf(!existsSync(FILE))('poem segments', () => {
  it('keeps segments short and loses no words, for all 237 poems', async () => {
    const { segmentsOf } = await import('../PoemsMarquee');
    const poems = JSON.parse(readFileSync(FILE, 'utf8')) as { id: number; marker: string; text: string }[];
    let k = 0;
    let longest = 0;
    for (const [i, p] of poems.entries()) {
      const segs = segmentsOf({ ...p, index: i }, i, () => ++k);
      expect(segs[0]).toMatchObject({ kind: 'marker', poemIndex: i });
      expect(segs[segs.length - 1].kind).toBe('sep');
      const words = segs.filter((s) => s.kind === 'text').flatMap((s) => s.text.trim().split(' '));
      expect(words.join(' ')).toBe(p.text.replace(/\s+/g, ' ').trim());
      for (const s of segs) longest = Math.max(longest, s.text.length);
    }
    expect(poems).toHaveLength(237);
    expect(longest).toBeLessThanOrEqual(80);
  });
});
