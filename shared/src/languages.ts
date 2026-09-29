/**
 * Mother-tongue choices, same list as the website (Qumanity_DPG/static/data/languages.json).
 * The stored value is the English name.
 */

export interface Language {
  name: string;
  native: string;
}

export const LANGUAGE_GROUPS: readonly { key: string; label: string; languages: readonly Language[] }[] = [
  {
    key: 'common',
    label: 'Common to everyone',
    languages: [{ name: 'English', native: 'English' }],
  },
  {
    key: 'indian',
    label: 'Indian languages',
    languages: [
      { name: 'Hindi', native: 'हिन्दी' },
      { name: 'Urdu', native: 'اردو' },
      { name: 'Bengali', native: 'বাংলা' },
      { name: 'Marathi', native: 'मराठी' },
      { name: 'Telugu', native: 'తెలుగు' },
      { name: 'Tamil', native: 'தமிழ்' },
      { name: 'Gujarati', native: 'ગુજરાતી' },
      { name: 'Kannada', native: 'ಕನ್ನಡ' },
      { name: 'Odia', native: 'ଓଡ଼ିଆ' },
      { name: 'Malayalam', native: 'മലയാളം' },
      { name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
      { name: 'Assamese', native: 'অসমীয়া' },
    ],
  },
  {
    key: 'subcontinent',
    label: 'Other Indian Sub-continent languages',
    languages: [
      { name: 'Pashto', native: 'پښتو' },
      { name: 'Sindhi', native: 'سنڌي' },
      { name: 'Saraiki', native: 'سرائیکی' },
      { name: 'Nepali', native: 'नेपाली' },
      { name: 'Burmese', native: 'မြန်မာ' },
      { name: 'Sinhala', native: 'සිංහල' },
      { name: 'Dari', native: 'دری' },
      { name: 'Balochi', native: 'بلوچی' },
      { name: 'Dzongkha', native: 'རྫོང་ཁ' },
      { name: 'Dhivehi', native: 'ދިވެހި' },
    ],
  },
];

export const LANGUAGE_NAMES: readonly string[] = LANGUAGE_GROUPS.flatMap((g) => g.languages.map((l) => l.name));

export const isLanguage = (name: unknown): name is string => typeof name === 'string' && LANGUAGE_NAMES.includes(name);
