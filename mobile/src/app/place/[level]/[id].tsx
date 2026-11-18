/**
 * Statistics of any place (readable by everyone; docs/sub_groups.md), drawn like the web dashboard
 * (2026-11-18): gender as percentage bars, age as bars, the four elements as a donut with a legend,
 * and the twelve sun signs as four pies — one per element, its three signs inside. Percentages are
 * of everyone living here; a count of 1-4 stays "<5" (website privacy rule), and with fewer than 5
 * people in the place no breakdown is shown at all — the sections stay, each saying why it's empty.
 * Chart maths: components/statsCharts.logic.ts.
 */

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Path } from 'react-native-svg';
import * as Q from '@/api/qumanity';
import {
  ELEMENT_COLORS,
  ELEMENT_ORDER,
  ELEMENT_SIGNS,
  GENDER_COLORS,
  GENDER_LABELS,
  GENDER_ORDER,
  SIGN_COLORS,
  donutArcs,
  isSuppressed,
  pctLabel,
  pieWedges,
  sliceFraction,
  sumCounts,
  type Count,
} from '@/components/statsCharts.logic';
import { BackHeader, ErrorText, Label, Screen } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

export default function PlaceStats() {
  const { level, id, name } = useLocalSearchParams<{ level: Q.BoardLevel; id: string; name?: string }>();
  const [stats, setStats] = useState<Q.PlaceStats | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    Q.placeStats(level, id).then(setStats, (e) => setError((e as Error).message));
  }, [level, id]);

  const total = stats?.total_humans ?? 0;
  const hidden = !stats || !total || isSuppressed(total);

  return (
    <Screen>
      <BackHeader title={name ?? id} />
      <ErrorText>{error}</ErrorText>
      {stats && (
        <>
          <View style={styles.card}>
            <Label>People presently living here</Label>
            <Text style={styles.big}>{typeof total === 'number' ? total.toLocaleString() : total}</Text>
            {hidden && (
              <Text style={styles.note}>
                {isSuppressed(total) ? 'Fewer than 5 registered here — detailed breakdown hidden to protect their privacy.' : 'No one has registered here yet.'}
              </Text>
            )}
          </View>
          {hidden ? (
            // The same sections, each saying why it's empty, so the page keeps its shape.
            ['Gender', 'Elements', 'Sun signs', 'Age'].map((t) => (
              <View key={t} style={styles.card}>
                <Label>{t}</Label>
                <View style={styles.lockedRow}>
                  <Ionicons name={isSuppressed(total) ? 'lock-closed-outline' : 'people-outline'} size={16} color={colors.faint} />
                  <Text style={styles.locked}>{isSuppressed(total) ? 'Hidden until 5 or more people live here.' : 'No one to count yet.'}</Text>
                </View>
              </View>
            ))
          ) : (
            <>
              <GenderBars stats={stats} />
              <ElementDonut stats={stats} />
              <SignPies stats={stats} />
              <AgeBars stats={stats} />
            </>
          )}
        </>
      )}
    </Screen>
  );
}

/** One row: label, bar (share of everyone here), percentage. */
function BarRow({ label, value, total, color }: { label: string; value: Count | undefined; total: Count; color: string }) {
  const pct = pctLabel(value, total);
  return (
    <View style={styles.barRow} accessibilityLabel={`${label}: ${pct}`}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.min(100, sliceFraction(value, total) * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.barValue}>{pct}</Text>
    </View>
  );
}

function GenderBars({ stats }: { stats: Q.PlaceStats }) {
  return (
    <View style={styles.card}>
      <Label>Gender</Label>
      {GENDER_ORDER.map((g) => (
        <BarRow key={g} label={GENDER_LABELS[g]} value={stats.gender[g] ?? 0} total={stats.total_humans} color={GENDER_COLORS[g]} />
      ))}
    </View>
  );
}

function AgeBars({ stats }: { stats: Q.PlaceStats }) {
  return (
    <View style={styles.card}>
      <Label>Age</Label>
      {stats.age_bands.map((a) => (
        <BarRow key={a.code} label={a.label} value={a.count} total={stats.total_humans} color={colors.saffron} />
      ))}
    </View>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
      <Text style={styles.legendPct}>{value}</Text>
    </View>
  );
}

const DONUT = 128;

function ElementDonut({ stats }: { stats: Q.PlaceStats }) {
  const total = stats.total_humans;
  const arcs = donutArcs(
    ELEMENT_ORDER.map((e) => ({ key: e, color: ELEMENT_COLORS[e], frac: sliceFraction(stats.elements[e], total) })),
    DONUT,
    20,
  );
  const c = DONUT / 2;
  return (
    <View style={styles.card}>
      <Label>Elements</Label>
      <View style={styles.chartRow}>
        <Svg width={DONUT} height={DONUT} accessibilityLabel="Elements donut chart">
          <Circle cx={c} cy={c} r={(DONUT - 20) / 2} stroke={colors.ink} strokeWidth={20} fill="none" />
          <G rotation={-90} origin={`${c}, ${c}`}>
            {arcs.map((a) => (
              <Circle key={a.key} cx={c} cy={c} r={a.r} stroke={a.color} strokeWidth={20} fill="none" strokeDasharray={a.dasharray} strokeDashoffset={a.dashoffset} />
            ))}
          </G>
        </Svg>
        <View style={{ flex: 1, gap: 6 }}>
          {ELEMENT_ORDER.map((e) => (
            <Legend key={e} color={ELEMENT_COLORS[e]} label={e} value={pctLabel(stats.elements[e], total)} />
          ))}
        </View>
      </View>
    </View>
  );
}

const PIE = 104;

/** Four pies, one per element; each pie's slices are its three signs (sized within the element). */
function SignPies({ stats }: { stats: Q.PlaceStats }) {
  const total = stats.total_humans;
  return (
    <View style={styles.card}>
      <Label>Sun signs</Label>
      <Text style={styles.note}>One circle per element. Each sign's share is of everyone living here.</Text>
      <View style={styles.pieGrid}>
        {ELEMENT_ORDER.map((e) => {
          const signs = ELEMENT_SIGNS[e];
          const wedges = pieWedges(
            signs.map((s) => ({ key: s, color: SIGN_COLORS[s], frac: isSuppressed(stats.signs[s]) ? 2 : Number(stats.signs[s] ?? 0) })),
            PIE,
          );
          const elementSum = sumCounts(signs.map((s) => stats.signs[s]));
          return (
            <View key={e} style={styles.pieCell}>
              <Text style={[styles.pieTitle, { color: ELEMENT_COLORS[e] }]}>
                {e} · {elementSum === null ? pctLabel(stats.elements[e], total) : pctLabel(elementSum, total)}
              </Text>
              <Svg width={PIE} height={PIE} accessibilityLabel={`${e} signs pie chart`}>
                <Circle cx={PIE / 2} cy={PIE / 2} r={PIE / 2} fill={colors.ink} />
                {wedges.map((w) =>
                  w.d ? (
                    <Path key={w.key} d={w.d} fill={w.color} stroke={colors.panel} strokeWidth={1.5} />
                  ) : (
                    <Circle key={w.key} cx={PIE / 2} cy={PIE / 2} r={PIE / 2} fill={w.color} />
                  ),
                )}
              </Svg>
              <View style={{ alignSelf: 'stretch', gap: 3, marginTop: space.sm }}>
                {signs.map((s) => (
                  <Legend key={s} color={SIGN_COLORS[s]} label={s} value={pctLabel(stats.signs[s], total)} />
                ))}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md },
  big: { color: colors.gold, fontFamily: fonts.displayBold, fontSize: 28 },
  lockedRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 4 },
  locked: { flex: 1, color: colors.faint, fontFamily: fonts.body, fontSize: 13 },
  note: { color: colors.dim, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17, marginTop: 4 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: 4 },
  barLabel: { width: 96, color: colors.dim, fontFamily: fonts.body, fontSize: 13 },
  track: { flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.ink, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5 },
  barValue: { width: 44, textAlign: 'right', color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, marginTop: space.sm },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  swatch: { width: 10, height: 10, borderRadius: 3 },
  legendLabel: { flex: 1, color: colors.text, fontFamily: fonts.body, fontSize: 13 },
  legendPct: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  pieGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.lg, marginTop: space.md },
  pieCell: { width: '47%', alignItems: 'center' },
  pieTitle: { fontFamily: fonts.bold, fontSize: 13.5, marginBottom: space.sm },
});
