/**
 * App-wide feature flags.
 *
 * Marquee shows verses from Tulsidas's Vinay Patrika. Original
 * text is public domain, but the Hindi translation by Hanuman
 * Prasad Poddar (d. 1971) remains under copyright until the end of 2031 (expires 1 January 2032).
 * Disabled pending a cleanly-licensed or work-for-hire replacement.
 * See docs/marquee_poems_archive/README.md (Qumanity_DPG) for re-enablement steps.
 *
 * Default false; set EXPO_PUBLIC_QM_MARQUEE_ENABLED=true when the poems are cleanly licensed.
 */
export const QM_MARQUEE_ENABLED = ['1', 'true', 'yes'].includes(
  (process.env.EXPO_PUBLIC_QM_MARQUEE_ENABLED ?? 'false').trim().toLowerCase(),
);
