/**
 * A timeline page with level tabs (Public: Village → Zone, Global: Country →
 * Earth). Compact by design so the board gets the screen: slim level tabs,
 * one place card (name, members, Qoins, Groups / Q-Punch / Stats), then the
 * Collective Board.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { useApp } from '@/state/app';
import { colors, fonts, radius, space, tint } from '@/theme';
import { BoardView } from './Board';
import { ElectionSentimentCard } from './ElectionSentimentCard';
import { GroupsSheet } from './GroupsSheet';
import { PerceptionCard } from './PerceptionCard';
import { QPunchSheet } from './QPunchSheet';

const LABEL: Record<Q.BoardLevel, string> = {
  village: 'Village',
  tehsil: 'Tehsil',
  district: 'District',
  state: 'State',
  zone: 'Zone',
  country: 'Country',
  continent: 'Continent',
  earth: 'Earth',
};

/** Id of the person's group at a level ("EARTH" for Earth, as on the website). */
export function placeIdAt(struct: Q.LocationStruct, level: Q.BoardLevel): string | null {
  if (level === 'earth') return 'EARTH';
  return (struct[level]?.id as string | undefined) ?? null;
}

export function LevelPage({ accent, levels }: { title?: string; note?: string; accent: string; levels: Q.BoardLevel[] }) {
  const { me } = useApp();
  const struct = me?.present_location_struct ?? {};
  // Tiers a country does not have are missing from the location (e.g. Nepal has no zone).
  const available = useMemo(() => levels.filter((l) => placeIdAt(struct, l)), [levels, struct]);
  const [level, setLevel] = useState<Q.BoardLevel>(available[0] ?? levels[0]);
  const [wallet, setWallet] = useState<number | null>(null);
  const [members, setMembers] = useState<number | null>(null);
  const [karma, setKarma] = useState<number | null>(null);
  // Only the paid-posting Composer needs a currency value (post prices are paid in Qoins, shown with their rupee reference);
  // the group wallet itself never shows currency, only members + Qoins (docs/qoins_wallet_system.md).
  const [currency, setCurrency] = useState('₹');
  const [council, setCouncil] = useState(false);
  const [groups, setGroups] = useState(false);
  const placeId = placeIdAt(struct, level);
  const placeName = level === 'earth' ? 'Earth' : ((struct[level]?.name as string | undefined) ?? LABEL[level]);

  useEffect(() => {
    Q.qoinsConfig().then((c) => setCurrency(c.symbol), () => undefined);
  }, []);

  useEffect(() => {
    setWallet(null);
    setMembers(null);
    setKarma(null);
    if (!placeId) return;
    Q.collectiveKarma(level, placeId).then((k) => setKarma(k.points), () => undefined);
    Q.groupWallet(level, placeId).then((w) => setWallet(w.balance_qoins), () => undefined);
    Q.placeStats(level, placeId).then((s) => setMembers(s.total_humans), () => undefined);
  }, [level, placeId]);

  return (
    <View style={styles.page}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabs} contentContainerStyle={styles.tabsInner}>
        {available.map((l) => {
          const on = l === level;
          return (
            <Pressable
              key={l}
              onPress={() => setLevel(l)}
              style={[styles.tab, on && { backgroundColor: accent, borderColor: accent }]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.tabText, on && styles.tabTextOn]}>{LABEL[l]}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.placeCard}>
        <View style={styles.placeTop}>
          <View style={[styles.placeIcon, { backgroundColor: tint(accent) }]}>
            <Ionicons name={level === 'earth' ? 'earth' : level === 'village' ? 'home' : 'location'} size={17} color={accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.placeName} numberOfLines={1}>
              {placeName}
            </Text>
            <Text style={styles.placeLevel}>{LABEL[level]} group</Text>
          </View>
          <Stat icon="people" value={members} label="members" />
          <Stat qoin value={wallet} label="Qoins" />
          <Stat icon="ribbon" value={karma} label="Karma" />
        </View>
        <View style={styles.actions}>
          <Action icon="apps" label="Groups" onPress={() => setGroups(true)} />
          <Action icon="shield-checkmark" label="Q-Punch" onPress={() => setCouncil(true)} />
          <Action
            icon="stats-chart"
            label="Stats"
            onPress={() => placeId && router.push({ pathname: '/place/[level]/[id]', params: { level, id: placeId, name: placeName } })}
          />
        </View>
      </View>

      {(level === 'country' || level === 'state') && placeId ? <ElectionSentimentCard level={level} id={placeId} /> : null}
      {(level === 'country' || level === 'zone') && placeId ? <PerceptionCard kind={level} id={placeId} name={placeName} /> : null}

      <View style={styles.boardWrap}>
        <BoardView level={level} currency={currency} />
      </View>

      <QPunchSheet level={level} visible={council} onClose={() => setCouncil(false)} />
      <Modal visible={groups} animationType="slide" onRequestClose={() => setGroups(false)}>
        <GroupsSheet level={level} struct={struct} onClose={() => setGroups(false)} />
      </Modal>
    </View>
  );
}

function Stat({ icon, qoin, value, label }: { icon?: React.ComponentProps<typeof Ionicons>['name']; qoin?: boolean; value: number | null; label: string }) {
  return (
    <View style={styles.stat} accessibilityLabel={`${value ?? 'loading'} ${label}`}>
      <View style={styles.statTop}>
        {qoin ? <Text style={styles.qoin}>💠</Text> : <Ionicons name={icon!} size={13} color={colors.dim} />}
        <Text style={styles.statValue}>{value === null ? '…' : value.toLocaleString()}</Text>
      </View>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Action({ icon, label, onPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.line }]} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={15} color={colors.gold} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.ink },
  tabs: { flexGrow: 0, paddingTop: space.sm },
  tabsInner: { gap: 6, paddingHorizontal: space.lg },
  tab: { height: 30, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, justifyContent: 'center' },
  tabText: { color: colors.dim, fontFamily: fonts.medium, fontSize: 12.5 },
  tabTextOn: { color: colors.onAccent, fontFamily: fonts.bold },
  placeCard: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    gap: space.sm,
  },
  placeTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  placeIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  placeName: { color: colors.text, fontFamily: fonts.bold, fontSize: 15.5 },
  placeLevel: { color: colors.faint, fontFamily: fonts.body, fontSize: 11.5, marginTop: 1 },
  stat: { alignItems: 'flex-end', minWidth: 52 },
  statTop: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  qoin: { fontSize: 11 },
  statValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 14 },
  statLabel: { color: colors.faint, fontFamily: fonts.body, fontSize: 10.5 },
  actions: { flexDirection: 'row', gap: 6 },
  action: {
    flex: 1,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.panelRaised,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  actionText: { color: colors.text, fontFamily: fonts.medium, fontSize: 12.5 },
  boardWrap: { flex: 1, paddingHorizontal: space.lg, paddingTop: space.sm },
});
