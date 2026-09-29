/**
 * Qumanity design system — dark-first, the website's saffron/gold on deep night blue.
 *
 * One scale for the whole app so screens stay compact and consistent:
 *   type   — 5 text sizes (title 21, heading 16, body 14.5, small 12.5, micro 11)
 *   space  — 4-pt grid; screens use `space.lg` (16) side padding
 *   radius — cards 14, controls 12, pills round
 */

export const colors = {
  // surfaces, darkest → lightest
  ink: '#060c16', // app background
  panel: '#0d1827', // cards, bars
  panelRaised: '#15233a', // controls on cards, pressed rows
  line: '#1f3049', // hairlines, borders
  // text
  text: '#eef3fa',
  dim: '#a3b2c6',
  faint: '#6a7c93',
  // brand
  saffron: '#ff9933',
  gold: '#ffc83d',
  goldSoft: '#ffc83d1f',
  // elements
  fire: '#ff6b4a',
  earth: '#4fcf73',
  air: '#cfd8e6',
  water: '#4aa8ff',
  // accents
  teal: '#2fd4a3',
  violet: '#9486ff',
  danger: '#ff5d5d',
  onAccent: '#1a1200',
} as const;

export const fonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_700Bold',
  body: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  bold: 'Inter_700Bold',
} as const;

export const type = {
  title: { fontFamily: fonts.displayBold, fontSize: 21, lineHeight: 27, color: colors.text },
  heading: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 21, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 14.5, lineHeight: 21, color: colors.text },
  small: { fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, color: colors.dim },
  micro: { fontFamily: fonts.medium, fontSize: 11, lineHeight: 14, color: colors.faint, letterSpacing: 0.3 },
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 8, md: 12, lg: 14, xl: 20, pill: 999 } as const;

export const timelineColors = {
  private: colors.violet,
  personal: colors.teal,
  public: colors.saffron,
  global: colors.water,
} as const;

/** A colour at low opacity, for tinted icon backgrounds and selected states. */
export const tint = (hex: string, alpha = '22') => `${hex.slice(0, 7)}${alpha}`;
