/**
 * Home page (signed out): who Qumanity is, the Sub-continent map, live member
 * statistics, and the two ways in — Sign in, or register a new member.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { IndiaScoreboard } from '@/components/IndiaScoreboard';
import { SubcontinentMap } from '@/components/SubcontinentMap';
import { Button, Logo, Screen, SectionTitle } from '@/components/ui';
import { colors, fonts, radius, space, timelineColors, tint, type } from '@/theme';

const TIMELINES: { name: string; note: string; color: string; icon: React.ComponentProps<typeof Ionicons>['name'] }[] = [
  { name: 'Global', note: 'Country · Continent · Earth', color: timelineColors.global, icon: 'earth' },
  { name: 'Public', note: 'Village → Zone', color: timelineColors.public, icon: 'people' },
  { name: 'Personal', note: 'Family · Friends · Business', color: timelineColors.personal, icon: 'heart' },
  { name: 'Private', note: 'Profile · Wallet · Messages', color: timelineColors.private, icon: 'lock-closed' },
];

const ELEMENT_ICON: Record<string, string> = { Fire: '🔥', Earth: '🌱', Air: '💨', Water: '💧' };
const GENDER_LABEL: Record<string, string> = { male: 'Male', female: 'Female', both: 'Third gender' };

export default function Welcome() {
  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          <Button title="Sign in" icon="log-in-outline" onPress={() => router.push('/login')} />
          <Button title="Register a new member" icon="person-add-outline" variant="ghost" onPress={() => router.push('/register')} />
        </View>
      }
    >
      <View style={styles.hero}>
        <Logo size={84} />
        <Text style={styles.brand}>Qumanity</Text>
        <Text style={styles.tag}>QUANTUM + HUMANITY</Text>
        <Text style={styles.intro}>A governance protocol for humanity, harmony & peace — your voice, from your village all the way to Earth.</Text>
      </View>

      <View style={styles.mapCard}>
        <View style={styles.mapFrame}>
          <SubcontinentMap width={300} />
        </View>
        <View style={styles.mapCaption}>
          <View style={styles.liveDot} />
          <Text style={type.small}>Live across the Indian Sub-continent — all 10 countries</Text>
        </View>
      </View>

      <SectionTitle>Four timelines</SectionTitle>
      <View style={styles.grid}>
        {TIMELINES.map((t) => (
          <View key={t.name} style={styles.card}>
            <View style={[styles.cardIcon, { backgroundColor: tint(t.color) }]}>
              <Ionicons name={t.icon} size={16} color={t.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{t.name}</Text>
              <Text style={styles.cardNote} numberOfLines={1}>
                {t.note}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <FounderPreview />
      <IndiaScoreboard />
      <MemberReviews />
      <AboutStats />
    </Screen>
  );
}

/** The Founder's Message preview (website homepage); the full letter opens on its own screen. */
function FounderPreview() {
  const [msg, setMsg] = useState<Q.FounderMessage | null>(null);
  useEffect(() => {
    Q.founderMessage().then(setMsg, () => undefined);
  }, []);
  if (!msg) return null;
  return (
    <>
      <SectionTitle>{msg.title}</SectionTitle>
      <View style={styles.card}>
        <Text style={[type.body, { flex: 1 }]} numberOfLines={5}>
          {msg.preview_text}
        </Text>
      </View>
      <Button title="Read the full message" variant="ghost" icon="book-outline" onPress={() => router.push('/founders-message')} />
    </>
  );
}

/** Average rating and the reviews members allowed to be public and an admin approved (first name + village). */
function MemberReviews() {
  const [data, setData] = useState<Q.PublicReviews | null>(null);
  useEffect(() => {
    Q.publicReviews().then(setData, () => undefined);
  }, []);
  if (!data || !data.count || data.average === null) return null;
  return (
    <View>
      <SectionTitle>What members say</SectionTitle>
      <View style={styles.ratingRow}>
        <Text style={styles.ratingBig}>{data.average.toFixed(1)}</Text>
        <View>
          <Stars value={Math.round(data.average)} size={15} />
          <Text style={styles.ratingCount}>
            {data.count} {data.count === 1 ? 'rating' : 'ratings'}
          </Text>
        </View>
      </View>
      {data.reviews.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }} style={{ marginTop: space.sm }}>
          {data.reviews.map((r, i) => (
            <View key={i} style={styles.review}>
              <Stars value={r.rating} size={12} />
              <Text style={styles.reviewText}>“{r.text}”</Text>
              <Text style={styles.reviewBy} numberOfLines={1}>
                {r.name}
                {r.place ? ` · ${r.place}` : ''}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function Stars({ value, size }: { value: number; size: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 1 }} accessibilityLabel={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons key={n} name={n <= value ? 'star' : 'star-outline'} size={size} color={colors.gold} />
      ))}
    </View>
  );
}

function AboutStats() {
  const [earth, setEarth] = useState<Q.PlaceStats | null>(null);
  const [countries, setCountries] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const [e, perCountry] = await Promise.all([
          Q.placeStats('earth', 'earth'),
          Promise.all(
            Q.SUBCONTINENT_COUNTRIES.map((c) =>
              Q.placeStats('country', c.id)
                .then((s) => [c.id, typeof s.total_humans === 'number' ? s.total_humans : 0] as const)
                .catch(() => [c.id, 0] as const),
            ),
          ),
        ]);
        if (!live) return;
        setEarth(e);
        setCountries(Object.fromEntries(perCountry));
      } catch (e) {
        if (live) setError((e as Error).message);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  if (error) return null; // an unreachable server just means no statistics, not an error banner on the home page
  if (!earth || !countries) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }

  const active = Q.SUBCONTINENT_COUNTRIES.filter((c) => (countries[c.id] ?? 0) > 0).length;

  return (
    <View>
      <SectionTitle>Qumanity today</SectionTitle>
      <View style={styles.kpis}>
        <Kpi value={earth.total_humans.toLocaleString()} label="members" icon="people" color={colors.gold} />
        <Kpi value={`${active}/10`} label="countries active" icon="flag" color={colors.saffron} />
        <Kpi value="8" label="levels to Earth" icon="layers" color={colors.water} />
      </View>

      <SectionTitle>Members by country</SectionTitle>
      <View style={styles.countryGrid}>
        {Q.SUBCONTINENT_COUNTRIES.map((c) => {
          const isIndia = c.id === 'O_AS_IND';
          return (
            <View key={c.id} style={[styles.countryChip, isIndia && styles.countryChipIndia]}>
              <Text style={[styles.countryName, isIndia && { color: colors.gold }]} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={[styles.countryCount, isIndia && { color: colors.gold }]}>{(countries[c.id] ?? 0).toLocaleString()}</Text>
            </View>
          );
        })}
      </View>

      <SectionTitle>Elements</SectionTitle>
      <View style={styles.pills}>
        {Object.entries(earth.elements).map(([k, v]) => (
          <Pill key={k} label={`${ELEMENT_ICON[k] ?? ''} ${k}`} value={v} />
        ))}
      </View>

      <SectionTitle>Gender · Age</SectionTitle>
      <View style={styles.pills}>
        {Object.entries(earth.gender).map(([k, v]) => (
          <Pill key={k} label={GENDER_LABEL[k] ?? k} value={v} />
        ))}
        {earth.age_bands.map((b) => (
          <Pill key={b.code} label={b.label} value={b.count} />
        ))}
      </View>

      <SectionTitle>Sun signs</SectionTitle>
      <View style={styles.pills}>
        {Object.entries(earth.signs).map(([k, v]) => (
          <Pill key={k} label={k} value={v} />
        ))}
      </View>
    </View>
  );
}

function Kpi({ value, label, icon, color }: { value: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string }) {
  return (
    <View style={styles.kpi}>
      <Ionicons name={icon} size={15} color={color} />
      <Text style={styles.kpiValue}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function Pill({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  ratingBig: { fontFamily: fonts.bold, fontSize: 30, color: colors.text },
  ratingCount: { fontFamily: fonts.body, fontSize: 11.5, color: colors.faint, marginTop: 2 },
  review: {
    width: 220,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.md,
    gap: 6,
  },
  reviewText: { fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, color: colors.text },
  reviewBy: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.faint },
  hero: { alignItems: 'center', marginTop: space.md, marginBottom: space.lg },
  brand: { fontFamily: fonts.displayBold, fontSize: 30, color: colors.gold, marginTop: space.sm },
  tag: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.dim, letterSpacing: 2.5, marginTop: 2 },
  intro: { fontFamily: fonts.body, color: colors.text, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: space.md, paddingHorizontal: space.sm },
  mapCard: {
    alignItems: 'center',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.md,
  },
  mapFrame: { borderRadius: 10, overflow: 'hidden' },
  mapCaption: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space.sm },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.earth },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: {
    flexBasis: '48%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: 10,
  },
  cardIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontFamily: fonts.bold, color: colors.text, fontSize: 13.5 },
  cardNote: { fontFamily: fonts.body, color: colors.faint, fontSize: 11 },
  loading: { alignItems: 'center', marginVertical: space.xl },
  kpis: { flexDirection: 'row', gap: space.sm },
  kpi: {
    flex: 1,
    backgroundColor: colors.panel,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingVertical: 10,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    gap: 2,
  },
  kpiValue: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  kpiLabel: { fontFamily: fonts.body, fontSize: 10.5, color: colors.faint, textAlign: 'center' },
  countryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  countryChip: {
    flexBasis: '31%',
    flexGrow: 1,
    backgroundColor: colors.panel,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  countryChipIndia: { backgroundColor: colors.goldSoft, borderColor: colors.gold },
  countryName: { fontFamily: fonts.medium, fontSize: 11.5, color: colors.text },
  countryCount: { fontFamily: fonts.bold, fontSize: 13, color: colors.dim, marginTop: 1 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.panel,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  pillLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.dim },
  pillValue: { fontFamily: fonts.bold, fontSize: 12, color: colors.text },
});
