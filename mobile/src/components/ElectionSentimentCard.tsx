/**
 * Anonymous percentages from members' election history — National Election on a Country page,
 * State Election on a State page, nowhere else (website election_core aggregates).
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { colors, fonts, radius, space } from '@/theme';

const PALETTE = [colors.saffron, colors.water, colors.teal, colors.faint];

export function ElectionSentimentCard({ level, id }: { level: 'country' | 'state'; id: string }) {
  const [data, setData] = useState<Q.ElectionSentiment | null>(null);

  useEffect(() => {
    setData(null);
    let live = true;
    Q.electionSentiment(level, id).then((d) => live && setData(d), () => undefined);
    return () => {
      live = false;
    };
  }, [level, id]);

  if (!data || !data.visible || !Array.isArray(data.parties)) return null;
  const parties = data.parties.filter((p) => p.code !== 'NOTVOTED' || p.count > 0);

  return (
    <View style={styles.card} accessibilityLabel={`${data.label}: ${parties.map((p) => `${p.label} ${p.pct}%`).join(', ')}`}>
      <View style={styles.head}>
        <Text style={styles.title}>📊 {data.label}</Text>
        <Text style={styles.meta}>
          {data.total_responses} {data.total_responses === 1 ? 'response' : 'responses'} · anonymous
        </Text>
      </View>
      {data.total_responses === 0 ? (
        <Text style={styles.meta}>No one here has shared their election history yet.</Text>
      ) : (
        <>
          <View style={styles.bar}>
            {parties.map((p, i) =>
              p.pct > 0 ? <View key={p.code} style={{ flex: p.pct, backgroundColor: PALETTE[i % PALETTE.length] }} /> : null,
            )}
          </View>
          <View style={styles.legend}>
            {parties.map((p, i) => (
              <View key={p.code} style={styles.item}>
                <View style={[styles.dot, { backgroundColor: PALETTE[i % PALETTE.length] }]} />
                <Text style={styles.itemText} numberOfLines={1}>
                  {p.label} <Text style={styles.pct}>{p.pct}%</Text>
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.lg,
    marginTop: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    gap: 6,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 13 },
  meta: { color: colors.faint, fontFamily: fonts.body, fontSize: 11 },
  bar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: colors.panelRaised },
  legend: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: 2 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 5, maxWidth: '100%' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  itemText: { color: colors.dim, fontFamily: fonts.body, fontSize: 11.5 },
  pct: { color: colors.text, fontFamily: fonts.bold },
});
