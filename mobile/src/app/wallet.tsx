/**
 * Private wallet (docs/qoins_wallet_system.md, transaction_history.md): balance,
 * the balance as the fewest Qoins (1 … 500), and weekly history for the last 3 months (Monday–Sunday weeks).
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { BackHeader, ErrorText, Label, Screen } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

export default function Wallet() {
  const [config, setConfig] = useState<Q.QoinsConfig | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof Q.walletHistory>> | null>(null);
  const [locked, setLocked] = useState(false);
  const [breakdown, setBreakdown] = useState<number[]>([]);
  const [error, setError] = useState<string>();

  async function load() {
    try {
      const [c, h, b] = await Promise.all([Q.qoinsConfig(), Q.walletHistory(), Q.walletBalance()]);
      setConfig(c);
      setHistory(h);
      setLocked(b.has_locked_share);
      setBreakdown(h.balance_qoins > 0 ? (await Q.topUpPreview(h.balance_qoins)).qoins : []);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const sym = config?.symbol ?? '';

  return (
    <Screen>
      <BackHeader title="Wallet" />
      <View style={styles.card}>
        <Label>Balance</Label>
        <Text style={styles.balance}>
          {sym}
          {history?.balance_qoins ?? '…'}
        </Text>
        {config && <Text style={styles.meta}>{config.currency_name} · Qoin values {config.denominations.join(', ')}</Text>}
        {breakdown.length > 0 && (
          <View style={styles.qoins}>
            {breakdown.map((q, i) => (
              <View key={i} style={styles.qoin}>
                <Text style={styles.qoinText}>{q}</Text>
              </View>
            ))}
          </View>
        )}
        {locked && <Text style={styles.locked}>Part of your registration Qoins is locked until your first council vote.</Text>}
      </View>

      <Text style={styles.section}>Weekly history · last 3 months</Text>
      {history?.weeks.length === 0 && <Text style={styles.meta}>No transactions yet.</Text>}
      {history?.weeks.map((w) => (
        <View key={`${w.year}-${w.week}`} style={styles.card}>
          <View style={styles.weekHead}>
            <Text style={styles.week}>
              Week {w.week} · {w.start} – {w.end}
            </Text>
            <Text style={[styles.change, w.change < 0 && { color: colors.danger }]}>
              {w.change > 0 ? '+' : ''}
              {w.change}
            </Text>
          </View>
          {w.rows.map((r, i) => (
            <View key={i} style={styles.tx}>
              <Text style={styles.txReason}>{r.reason.replace(/_/g, ' ')}</Text>
              <Text style={[styles.txAmt, r.amount < 0 && { color: colors.danger }]}>
                {r.amount > 0 ? '+' : ''}
                {r.amount}
              </Text>
            </View>
          ))}
        </View>
      ))}
      {!!history?.older_weeks_hidden && <Text style={styles.meta}>{history.older_weeks_hidden} older weeks are visible to the council only.</Text>}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md },
  balance: { color: colors.gold, fontFamily: fonts.displayBold, fontSize: 30 },
  meta: { color: colors.dim, fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  qoins: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.md },
  qoin: { minWidth: 40, height: 40, borderRadius: 20, backgroundColor: colors.saffron, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  qoinText: { color: colors.onAccent, fontFamily: fonts.bold, fontSize: 13 },
  locked: { color: colors.saffron, fontFamily: fonts.body, fontSize: 13, marginTop: space.md },
  section: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, marginTop: space.lg, marginBottom: space.sm },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm },
  week: { color: colors.text, fontFamily: fonts.bold },
  change: { color: colors.earth, fontFamily: fonts.bold },
  tx: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  txReason: { color: colors.dim, fontFamily: fonts.body, textTransform: 'capitalize' },
  txAmt: { color: colors.text, fontFamily: fonts.medium },
});
