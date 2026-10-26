/**
 * App tour: a short, swipeable walk through every part of Qumanity and why it matters.
 * Shown once after a new member's first sign-in (Skip is always there); can be replayed from
 * Settings. Finishing or skipping leads to the one-time rating (app/rate.tsx) — a replay never
 * asks again.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View, type ListViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Q from '@/api/qumanity';
import { Button, Logo } from '@/components/ui';
import { colors, fonts, radius, space, timelineColors, tint } from '@/theme';

type Icon = React.ComponentProps<typeof Ionicons>['name'];

interface Slide {
  key: string;
  icon?: Icon;
  logo?: boolean;
  color: string;
  title: string;
  body: string;
  points: { icon: Icon; text: string }[];
}

const SLIDES: Slide[] = [
  {
    key: 'welcome',
    logo: true,
    color: colors.gold,
    title: 'Welcome to Qumanity',
    body: 'Your village, your voice — heard all the way to Earth.',
    points: [
      { icon: 'people', text: 'Everyone living in your village is in your group, automatically' },
      { icon: 'trending-up', text: 'Good ideas rise level by level: Village → Tehsil → … → Earth' },
      { icon: 'shield-checkmark', text: 'Your identity stays private; you choose what to share' },
    ],
  },
  {
    key: 'timelines',
    icon: 'albums',
    color: colors.water,
    title: 'Four timelines',
    body: 'The tabs at the bottom are four views of your life on Qumanity.',
    points: [
      { icon: 'earth', text: 'Global — your Country, Asia and Earth' },
      { icon: 'people', text: 'Public — where you live now: Village up to Zone' },
      { icon: 'heart', text: 'Personal — your Family, Friends and Business groups' },
      { icon: 'lock-closed', text: 'Private — your profile, wallet and private messages' },
    ],
  },
  {
    key: 'locations',
    icon: 'map',
    color: timelineColors.global,
    title: 'Global & Public, tier by tier',
    body: 'Both of those tabs are nested location tiers you can drill into.',
    points: [
      { icon: 'earth', text: 'Global: Earth → your Continent → your Country' },
      { icon: 'navigate', text: 'Public: your Zone → State → District → Tehsil → Village' },
      { icon: 'checkmark-circle', text: "Public's tiers are exactly the present location you chose at registration" },
    ],
  },
  {
    key: 'board',
    icon: 'chatbubbles',
    color: timelineColors.public,
    title: 'The Collective Board',
    body: 'Post in your village for free. Neighbours vote +1, 0 or −1 for 7 days.',
    points: [
      { icon: 'arrow-up-circle', text: '+10 or more lifts a post to your Tehsil, then higher' },
      { icon: 'snow', text: '❄ Frozen shows finished posts, best score first, with comments' },
      { icon: 'gift', text: 'Posts that end positive earn you Qoins — more the higher they rise' },
    ],
  },
  {
    key: 'place',
    icon: 'location',
    color: timelineColors.public,
    title: 'Your place at a glance',
    body: 'The card above every board shows your group and its tools.',
    points: [
      { icon: 'people', text: 'Members — everyone presently living here' },
      { icon: 'diamond', text: '💠 Qoins — the group wallet everyone helps grow' },
      { icon: 'apps', text: 'Groups — village sub-groups, or places below with statistics' },
      { icon: 'stats-chart', text: 'Stats — people, elements, signs, genders and ages' },
    ],
  },
  {
    key: 'council',
    icon: 'shield-checkmark',
    color: colors.violet,
    title: 'Q-Punch council',
    body: 'Five seats lead every group, from your village to Earth.',
    points: [
      { icon: 'sunny', text: 'Each month a new sun-sign pair — one man, one woman — leads' },
      { icon: 'checkbox', text: 'Vote once a year, for candidates of your own sign and gender' },
      { icon: 'hand-left', text: 'Anyone can register as a volunteer in seat 5' },
    ],
  },
  {
    key: 'personal',
    icon: 'heart',
    color: timelineColors.personal,
    title: 'People you trust',
    body: 'Keep family, friends and business in their own groups.',
    points: [
      { icon: 'search', text: 'Find anyone by their 12-digit search code' },
      { icon: 'mail-unread', text: 'Send one message request; they accept, decline or wait' },
      { icon: 'add-circle', text: 'Create your own groups with the + button' },
    ],
  },
  {
    key: 'private',
    icon: 'lock-closed',
    color: timelineColors.private,
    title: 'Private stays private',
    body: 'Your 9-digit Private ID and PIN are your keys — never share them.',
    points: [
      { icon: 'eye-off', text: 'Private ID stays hidden; your PIN reveals it for 30 seconds' },
      { icon: 'wallet', text: 'Wallet — your Qoins and weekly history' },
      { icon: 'language', text: 'Language — switch Qumanity to your Mother tongue, English or a 3rd language, in Settings' },
      { icon: 'time', text: 'Time-box — the current time, weather and Vedic calendar for where you live' },
      { icon: 'power', text: 'Sign out any time with the power icon at the top' },
    ],
  },
];

export default function Tour() {
  const { replay } = useLocalSearchParams<{ replay?: string }>();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const list = useRef<FlatList<Slide>>(null);
  const last = index === SLIDES.length - 1;

  const onViewable = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  async function finish(status: 'done' | 'skipped') {
    if (replay) return router.back();
    setBusy(true);
    try {
      const s = await Q.setTour(status);
      // Finished or skipped, everyone gets their one chance to rate Qumanity.
      if (!s.review_done) router.replace('/rate');
      else router.back();
    } catch {
      router.back(); // never trap anyone in the tour because the network hiccuped
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (last) return finish('done');
    list.current?.scrollToIndex({ index: index + 1, animated: true });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.top}>
        <Text style={styles.count}>
          {index + 1} / {SLIDES.length}
        </Text>
        {!last && (
          <View style={styles.topActions}>
            <Pressable onPress={() => finish('skipped')} accessibilityRole="button" hitSlop={12} style={styles.skip}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
            <Pressable onPress={() => finish('skipped')} accessibilityRole="button" accessibilityLabel="Exit tutorial" hitSlop={12} style={styles.exit}>
              <Ionicons name="close" size={18} color={colors.dim} />
            </Pressable>
          </View>
        )}
      </View>

      <FlatList
        ref={list}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.hero, { backgroundColor: tint(item.color, '1a'), borderColor: tint(item.color, '55') }]}>
              {item.logo ? <Logo size={112} /> : <Ionicons name={item.icon!} size={52} color={item.color} />}
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
            <View style={styles.points}>
              {item.points.map((p) => (
                <View key={p.text} style={styles.point}>
                  <View style={[styles.pointIcon, { backgroundColor: tint(item.color) }]}>
                    <Ionicons name={p.icon} size={15} color={item.color} />
                  </View>
                  <Text style={styles.pointText}>{p.text}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      />

      <View style={styles.bottom}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View key={s.key} style={[styles.dot, i === index && styles.dotOn]} />
          ))}
        </View>
        <Button title={last ? (replay ? 'Close' : 'Start using Qumanity') : 'Next'} icon={last ? 'checkmark' : 'arrow-forward'} onPress={next} busy={busy} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.sm, height: 44 },
  count: { color: colors.faint, fontFamily: fonts.medium, fontSize: 12 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  skip: { paddingHorizontal: space.md, height: 30, borderRadius: radius.pill, backgroundColor: colors.panel, justifyContent: 'center' },
  skipText: { color: colors.dim, fontFamily: fonts.bold, fontSize: 13 },
  exit: { width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  slide: { paddingHorizontal: space.xl, paddingTop: space.lg, alignItems: 'center' },
  hero: { width: 148, height: 148, borderRadius: 40, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: space.xl },
  title: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 24, textAlign: 'center' },
  body: { color: colors.dim, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: space.sm, marginBottom: space.xl },
  points: { alignSelf: 'stretch', gap: space.sm },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.md,
  },
  pointIcon: { width: 30, height: 30, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  pointText: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },
  bottom: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.md },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotOn: { width: 20, backgroundColor: colors.gold },
});
