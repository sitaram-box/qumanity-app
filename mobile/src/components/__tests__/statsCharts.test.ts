import { describe, expect, it } from 'vitest';
import { SIGN_COLORS, donutArcs, pctLabel, pieWedges, sliceFraction, sumCounts } from '../statsCharts.logic';

describe('Stats: percentages keep the website privacy rule', () => {
  it('plain percentages, rounded', () => {
    expect(pctLabel(45, 100)).toBe('45%');
    expect(pctLabel(1, 3)).toBe('33%');
  });
  it('"<5" on either side is never turned into a number', () => {
    expect(pctLabel('<5', 100)).toBe('<5');
    expect(pctLabel(3, '<5')).toBe('<5');
    expect(pctLabel(0, 0)).toBe('<5');
  });
  it('a "<5" slice is sized as a small wedge (2), never zero, never its real value', () => {
    expect(sliceFraction('<5', 100)).toBe(0.02);
    expect(sliceFraction(50, '<5')).toBe(0);
  });
  it('a sum including "<5" is unknowable', () => {
    expect(sumCounts([10, 5, 3])).toBe(18);
    expect(sumCounts([10, '<5', 3])).toBeNull();
  });
});

describe('Stats: chart geometry', () => {
  it('donut arcs follow each other round the ring and skip empty slices', () => {
    const arcs = donutArcs(
      [
        { key: 'Fire', frac: 0.5, color: '#f00' },
        { key: 'Earth', frac: 0, color: '#0f0' },
        { key: 'Air', frac: 0.5, color: '#00f' },
      ],
      120,
      20,
    );
    expect(arcs.map((a) => a.key)).toEqual(['Fire', 'Air']);
    expect(arcs[1].dashoffset).toBeCloseTo(-Math.PI * 50); // starts where Fire ended (half of 2πr, r = 50)
  });
  it('pie wedges: proportional within the pie; one slice alone is a full circle', () => {
    const w = pieWedges(
      [
        { key: 'Aries', frac: 3, color: '#a' },
        { key: 'Leo', frac: 1, color: '#b' },
      ],
      100,
    );
    expect(w[0].d).toContain(' 0 1 1 '); // 75% → the large-arc flag
    expect(w[1].d).toContain(' 0 0 1 ');
    expect(pieWedges([{ key: 'Aries', frac: 5, color: '#a' }], 100)[0].d).toBeNull();
    expect(pieWedges([], 100)).toEqual([]);
  });
  it('three shades per element, all different', () => {
    expect(new Set([SIGN_COLORS.Aries, SIGN_COLORS.Leo, SIGN_COLORS.Sagittarius]).size).toBe(3);
    expect(SIGN_COLORS.Leo).toBe('#ff5b45'); // the middle sign keeps the element's own colour
  });
});
