import { describe, expect, it } from 'vitest';
import { DEFAULT_DOWNLOAD_URL, isNewer, safeDownloadUrl } from '../updateCheck.logic';

describe('Update check: is the website version newer than this build?', () => {
  it('1.0.1 on the website, 1.0.0 installed: newer', () => {
    expect(isNewer('1.0.1', '1.0.0')).toBe(true);
  });

  it('same version: no banner', () => {
    expect(isNewer('1.0.1', '1.0.1')).toBe(false);
  });

  it('this build is newer than the website figure: no banner', () => {
    expect(isNewer('1.0.1', '1.0.2')).toBe(false);
  });

  it('compares numbers, not text: 1.0.10 is newer than 1.0.9', () => {
    expect(isNewer('1.0.10', '1.0.9')).toBe(true);
    expect(isNewer('1.0.9', '1.0.10')).toBe(false);
  });

  it('missing parts count as 0: "1.1" vs "1.0.5"', () => {
    expect(isNewer('1.1', '1.0.5')).toBe(true);
    expect(isNewer('1.0', '1.0.0')).toBe(false);
  });

  it('missing or blank versions never show the banner', () => {
    expect(isNewer(undefined, '1.0.0')).toBe(false);
    expect(isNewer('1.0.1', null)).toBe(false);
    expect(isNewer('  ', '1.0.0')).toBe(false);
  });
});

describe('Update check: the download link', () => {
  it('uses the https link the website sends', () => {
    expect(safeDownloadUrl('https://qumanity.in/app')).toBe('https://qumanity.in/app');
  });

  it('anything not https falls back to the known download page', () => {
    expect(safeDownloadUrl('http://qumanity.in/app')).toBe(DEFAULT_DOWNLOAD_URL);
    expect(safeDownloadUrl('javascript:alert(1)')).toBe(DEFAULT_DOWNLOAD_URL);
    expect(safeDownloadUrl(undefined)).toBe(DEFAULT_DOWNLOAD_URL);
    expect(safeDownloadUrl(42)).toBe(DEFAULT_DOWNLOAD_URL);
  });
});
