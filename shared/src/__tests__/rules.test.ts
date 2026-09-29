import { describe, expect, it } from 'vitest';
import { getZodiacSign } from '../zodiac';
import { countryCodeOf, isSubcontinentCountry, SUBCONTINENT_COUNTRY_IDS, tierLabel } from '../tiers';
import {
  canPost,
  hasGroup,
  isGroupActive,
  MAX_PERSONAL_GROUPS,
  modeForLevel,
  privateChatId,
  publicGroupName,
  timelineForLevel,
} from '../groups';
import { commentsOpen, isEarthHonour, outcomeFor, POST_RULES, votingEnd } from '../posts';
import {
  canStandVillageSeat,
  canVoteVillageSeat,
  electionsAllowed,
  houseSize,
  signCycleOn,
  signCycleWindow,
} from '../elections';

describe('zodiac', () => {
  it('sun sign from DOB, including the Capricorn wrap', () => {
    expect(getZodiacSign('1990-08-01')?.sign).toBe('Leo');
    expect(getZodiacSign('1990-12-31')?.sign).toBe('Capricorn');
    expect(getZodiacSign('1990-01-20')?.sign).toBe('Aquarius');
    expect(() => getZodiacSign('1990-02-30')).toThrow();
  });
});

describe('tiers and timelines', () => {
  it('10 Sub-continent countries with local tier names', () => {
    expect(SUBCONTINENT_COUNTRY_IDS).toHaveLength(10);
    expect(isSubcontinentCountry('O_AS_CHN')).toBe(false);
    expect(tierLabel(countryCodeOf('O_AS_NPL'), 'village')).toBe('Ward');
    expect(hasGroup('NPL', 'zone')).toBe(false);
    expect(hasGroup('AFG', 'tehsil')).toBe(false);
  });

  it('Public = Village…Zone, Global = Country…Earth', () => {
    expect(timelineForLevel('zone')).toBe('public');
    expect(timelineForLevel('country')).toBe('global');
    expect(timelineForLevel('earth')).toBe('global');
  });

  it('names groups with local tier labels', () => {
    expect(publicGroupName('Bawana', 'IND', 'tehsil')).toBe('Bawana Tehsil Group');
    expect(publicGroupName('Earth', 'IND', 'earth')).toBe('Earth Group');
    expect(publicGroupName('Kondli Village', 'IND', 'village')).toBe('Kondli Village Group');
  });
});

describe('posting permissions (corrected Part 4)', () => {
  const resident = { isResident: true, isCouncil: false, isSocialWorker: false };
  const socialWorker = { ...resident, isSocialWorker: true };
  const council = { isResident: false, isCouncil: true, isSocialWorker: false };
  const birthOnly = { isResident: false, isCouncil: false, isSocialWorker: false };

  it('modes per level', () => {
    expect(modeForLevel('village')).toBe('open');
    expect(modeForLevel('district')).toBe('social_workers');
    for (const l of ['tehsil', 'state', 'zone', 'country', 'continent', 'earth'] as const) {
      expect(modeForLevel(l)).toBe('council');
    }
  });

  it('village: residents post, birth-only members read', () => {
    expect(canPost('open', resident)).toBe(true);
    expect(canPost('open', birthOnly)).toBe(false);
  });

  it('district: only approved Social Workers (and council)', () => {
    expect(canPost('social_workers', resident)).toBe(false);
    expect(canPost('social_workers', socialWorker)).toBe(true);
    expect(canPost('social_workers', council)).toBe(true);
  });

  it('tehsil and above: council only; disabled groups: nobody', () => {
    expect(canPost('council', socialWorker)).toBe(false);
    expect(canPost('council', council)).toBe(true);
    expect(canPost('open', resident, false)).toBe(false);
    expect(isGroupActive([])).toBe(false);
    expect(isGroupActive(['482915307'])).toBe(true);
  });

  it('personal groups and private chat ids', () => {
    expect(MAX_PERSONAL_GROUPS).toBe(2);
    expect(privateChatId('9000000000', '1000000000')).toBe('1000000000_9000000000');
  });
});

describe('post outcomes (Part 1)', () => {
  it('thresholds and voting days grow per level', () => {
    expect(POST_RULES.village).toEqual({ days: 7, threshold: 10 });
    expect(POST_RULES.earth).toEqual({ days: 14, threshold: 100_000_000 });
    const start = new Date('2026-09-26T00:00:00Z');
    expect(votingEnd('tehsil', start).toISOString()).toBe('2026-10-04T00:00:00.000Z');
  });

  it('elevate / freeze / remove', () => {
    expect(outcomeFor('village', 10)).toBe('elevate');
    expect(outcomeFor('village', 9)).toBe('freeze');
    expect(outcomeFor('village', 0)).toBe('remove');
    expect(outcomeFor('village', -3)).toBe('remove');
    expect(outcomeFor('district', 999)).toBe('freeze');
    expect(outcomeFor('continent', 10_000_000)).toBe('elevate');
  });

  it('earth never elevates; honour at +100M', () => {
    expect(outcomeFor('earth', 500_000_000)).toBe('freeze');
    expect(isEarthHonour('earth', 100_000_000)).toBe(true);
    expect(outcomeFor('earth', 0)).toBe('remove');
  });

  it('comments only after voting', () => {
    expect(commentsOpen('active')).toBe(false);
    expect(commentsOpen('frozen')).toBe(true);
    expect(commentsOpen('elevated')).toBe(true);
    expect(commentsOpen('removed')).toBe(false);
  });
});

describe('elections (Part 5)', () => {
  it('minimum users per level', () => {
    expect(electionsAllowed('village', 99)).toBe(false);
    expect(electionsAllowed('village', 100)).toBe(true);
    expect(electionsAllowed('earth', 9_999_999)).toBe(false);
  });

  it('house sizes: 24 in villages, 8 above', () => {
    expect(houseSize('village')).toBe(24);
    expect(houseSize('tehsil')).toBe(8);
    expect(houseSize('earth')).toBe(8);
  });

  it('monthly sign cycles', () => {
    expect(signCycleOn(new Date('2026-08-01T00:00:00Z'))).toBe('Leo');
    expect(signCycleOn(new Date('2027-01-05T00:00:00Z'))).toBe('Capricorn');
    const w = signCycleWindow('Capricorn', 2026);
    expect(w.start.toISOString()).toBe('2026-12-22T00:00:00.000Z');
    expect(w.nominationEnd.toISOString()).toBe('2026-12-29T00:00:00.000Z');
    expect(w.end.toISOString()).toBe('2027-01-19T23:59:59.000Z');
  });

  it('voters and candidates match sign and gender', () => {
    const leoMan = { gender: 'M' as const, zodiac_type: 'Leo', age_type: 'Y' as const };
    expect(canVoteVillageSeat(leoMan, 'Leo', 'M')).toBe(true);
    expect(canVoteVillageSeat(leoMan, 'Leo', 'F')).toBe(false);
    expect(canVoteVillageSeat(leoMan, 'Virgo', 'M')).toBe(false);
    expect(canStandVillageSeat(leoMan, 'Leo', 'M')).toBe(true);
    expect(canStandVillageSeat({ ...leoMan, age_type: 'B' }, 'Leo', 'M')).toBe(false);
  });
});
