/** Homepage India Scoreboard (website elemental_core.india_scoreboard): total members, Zones and top States. */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { colors, fonts, radius, space } from '@/theme';
import { SectionTitle } from './ui';

export function IndiaScoreboard() {
  const [data, setData] = useState<Q.Scoreboard | null>(null);
  useEffect(() => {
    Q.scoreboardIndia().then(setData, () => undefined);
  }, []);
  if (!data) return null;
  const top = Math.max(1, ...data.zones.map((z) => z.total_users), ...data.states.map((s) => s.total_users));
  return (
    <>
      <SectionTitle>India scoreboard</SectionTitle>
      <View style={styles.card}>
        <Text style={styles.total}>{data.total_members.toLocaleString('en-IN')}</Text>
        <Text style={styles.meta}>members in India</Text>
        <Text style={styles.h}>Zones</Text>
        {data.zones.map((z) => <Row key={z.id} rank={z.rank} name={z.name} n={z.total_users} top={top} />)}
        <Text style={styles.h}>Top states</Text>
        {data.states.map((s) => <Row key={s.id} rank={s.rank} name={s.name} n={s.total_users} top={top} />)}
      </View>
    </>
  );
}

function Row({ rank, name, n, top }: { rank: number; name: string; n: number; top: number }) {
  const first = rank === 1 && n > 0;
  return (
    <View style={styles.row}>
      <Text style={[styles.rank, first && { color: colors.gold }]}>{rank}</Text>
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={[styles.name, first && { color: colors.gold }]} numberOfLines={1}>{name}</Text>
          <Text style={styles.n}>{n.toLocaleString('en-IN')}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(1, (100 * n) / top)}%`, backgroundColor: first ? colors.gold : colors.saffron }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: space.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  total: { color: colors.gold, fontFamily: fonts.displayBold, fontSize: 34 },
  meta: { color: colors.dim, fontFamily: fonts.body, fontSize: 12.5 },
  h: { color: colors.text, fontFamily: fonts.bold, fontSize: 13.5, marginTop: space.md, marginBottom: 2 },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: 6 },
  rank: { width: 20, color: colors.faint, fontFamily: fonts.bold, fontSize: 12.5, textAlign: 'center' },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm },
  name: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 12.5 },
  n: { color: colors.dim, fontFamily: fonts.medium, fontSize: 12 },
  track: { height: 4, borderRadius: 2, backgroundColor: colors.line, marginTop: 3, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
});
