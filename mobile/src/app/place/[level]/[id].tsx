/** Statistics of any place (readable by everyone; docs/sub_groups.md): people, elements, signs, genders, ages. */

import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { BackHeader, ErrorText, Label, Screen } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

const ELEMENT_COLOR: Record<string, string> = { Fire: colors.fire, Earth: colors.earth, Air: colors.air, Water: colors.water };
const GENDER: Record<string, string> = { male: 'Male', female: 'Female', both: 'Third gender' };

export default function PlaceStats() {
  const { level, id, name } = useLocalSearchParams<{ level: Q.BoardLevel; id: string; name?: string }>();
  const [stats, setStats] = useState<Q.PlaceStats | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    Q.placeStats(level, id).then(setStats, (e) => setError((e as Error).message));
  }, [level, id]);

  return (
    <Screen>
      <BackHeader title={name ?? id} />
      <ErrorText>{error}</ErrorText>
      {stats && (
        <>
          <View style={styles.card}>
            <Label>People presently living here</Label>
            <Text style={styles.big}>{stats.total_humans.toLocaleString()}</Text>
          </View>
          <Bars title="Elements" data={stats.elements} color={(k) => ELEMENT_COLOR[k] ?? colors.gold} />
          <Bars title="Gender" data={Object.fromEntries(Object.entries(stats.gender).map(([k, v]) => [GENDER[k] ?? k, v]))} />
          <Bars title="Age" data={Object.fromEntries(stats.age_bands.map((a) => [a.label, a.count]))} />
          <Bars title="Sun signs" data={stats.signs} />
        </>
      )}
    </Screen>
  );
}

function Bars({ title, data, color }: { title: string; data: Record<string, number>; color?: (k: string) => string }) {
  const max = Math.max(1, ...Object.values(data));
  return (
    <View style={styles.card}>
      <Label>{title}</Label>
      {Object.entries(data).map(([k, v]) => (
        <View key={k} style={styles.barRow} accessibilityLabel={`${k}: ${v}`}>
          <Text style={styles.barLabel}>{k}</Text>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(100 * v) / max}%`, backgroundColor: color?.(k) ?? colors.saffron }]} />
          </View>
          <Text style={styles.barValue}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md },
  big: { color: colors.gold, fontFamily: fonts.displayBold, fontSize: 28 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: 3 },
  barLabel: { width: 96, color: colors.dim, fontFamily: fonts.body, fontSize: 13 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.ink, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  barValue: { width: 40, textAlign: 'right', color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
});
