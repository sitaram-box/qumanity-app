/**
 * Private wallet (docs/qoins_wallet_system.md, transaction_history.md): balance,
 * the balance as the fewest Qoins (1 … 500), simulated donation (as on the
 * website — no payment provider is connected yet), and weekly history for the
 * last 3 months (Monday–Sunday weeks).
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { BackHeader, Button, ErrorText, Label, Screen } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

export default function Wallet() {
  const [config, setConfig] = useState<Q.QoinsConfig | null>(null);
  const [history, setHistory] = useState<Awaited<ReturnType<typeof Q.walletHistory>> | null>(null);
  const [locked, setLocked] = useState(false);
  const [breakdown, setBreakdown] = useState<number[]>([]);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
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

  async function donate() {
    setBusy(true);
    setError(undefined);
    setMsg(undefined);
    try {
      const r = await Q.simulatedTopUp(Number(amount));
      setMsg(`Donated ${config?.symbol ?? ''}${r.amount_rupees} — Qoins credited.`);
      setAmount('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const sym = config?.symbol ?? '';
  const amt = Number(amount);

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

      <View style={styles.card}>
        <Label>Donate (testing)</Label>
        <Text style={styles.meta}>No payment service is connected yet, so this credits Qoins without real money — exactly like the website.</Text>
        <View style={styles.row}>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(t.replace(/\D/g, '').slice(0, 3))}
            keyboardType="number-pad"
            placeholder="Amount"
            placeholderTextColor={colors.faint}
            style={styles.input}
            accessibilityLabel="Donation amount"
          />
          <Button title="Donate" variant="ghost" onPress={donate} busy={busy} disabled={!amt || amt > (config?.max_donation ?? 200)} />
        </View>
        {msg && <Text style={styles.ok}>{msg}</Text>}
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
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: space.md },
  input: { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink, paddingHorizontal: space.lg, color: colors.text, fontFamily: fonts.body },
  ok: { color: colors.earth, fontFamily: fonts.medium, marginTop: space.sm },
  section: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, marginTop: space.lg, marginBottom: space.sm },
  weekHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: space.sm },
  week: { color: colors.text, fontFamily: fonts.bold },
  change: { color: colors.earth, fontFamily: fonts.bold },
  tx: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  txReason: { color: colors.dim, fontFamily: fonts.body, textTransform: 'capitalize' },
  txAmt: { color: colors.text, fontFamily: fonts.medium },
});
