/**
 * Election history (docs/election_history.md): optional, visible only to the user. National Election (Lok Sabha)
 * shows the 2 most recent elections + the next one (always exactly 3 years, rolling forward on
 * its own — see election_core.loksabha_years); State Election (Vidhan Sabha) is last/next. Party options are per
 * the user's own country (election_core.parties_for_country), 4 choices: the two leading
 * alliances, "OTH" (regional/NOTA), and an explicit "Not Voted". Q-Punch rows come from the
 * ballots actually cast (never typed).
 */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { BackHeader, Button, Card, Chip, ErrorText, Label, Lead, Screen } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

export default function ElectionHistory() {
  const [data, setData] = useState<Q.ElectionHistory | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    Q.electionHistory().then(setData, (e) => setError((e as Error).message));
  }, []);

  if (!data) return <Screen><BackHeader title="Election history" /><ErrorText>{error}</ErrorText></Screen>;

  const years = data.party.loksabha_years.map(String);
  const nextYear = years[years.length - 1];

  const setLs = (y: string, v: string | null) =>
    setData({ ...data, party: { ...data.party, loksabha: { ...data.party.loksabha, [y]: v } } });
  const setVs = (k: 'last' | 'next', v: string | null) =>
    setData({ ...data, party: { ...data.party, vidhansabha: { ...data.party.vidhansabha, [k]: v } } });

  async function save() {
    setBusy(true);
    setMsg(undefined);
    setError(undefined);
    try {
      await Q.saveElectionHistory(data!.party);
      setMsg('Saved. Only you can see this.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const Pick = ({ value, onPick }: { value: string | null; onPick: (v: string | null) => void }) => (
    <View style={styles.chips}>
      {data.parties.map(([code, label]) => (
        <Chip key={code} label={label} selected={value === code} onPress={() => onPick(value === code ? null : code)} />
      ))}
    </View>
  );

  return (
    <Screen footer={<Button title="Save" onPress={save} busy={busy} />}>
      <BackHeader title="Election history" />
      <Lead>Optional. Only you see your choices. Totals appear anonymously, as percentages, on your Country page (National Election) and State page (State Election).</Lead>

      <Card>
        <Text style={styles.section}>🏛️ National Election</Text>
        {years.map((y) => (
          <View key={y}>
            <Label>{y === nextYear ? `${y} · upcoming · leaning towards` : `${y} · voted for`}</Label>
            <Pick value={data.party.loksabha[y]} onPick={(v) => setLs(y, v)} />
          </View>
        ))}
      </Card>

      <Card>
        <Text style={styles.section}>🗳️ State Election</Text>
        <Label>Last election · voted for</Label>
        <Pick value={data.party.vidhansabha.last} onPick={(v) => setVs('last', v)} />
        <Label>Next election · leaning towards</Label>
        <Pick value={data.party.vidhansabha.next} onPick={(v) => setVs('next', v)} />
      </Card>

      <Text style={styles.section}>Q-Punch (from your ballots)</Text>
      {data.qpunch.length === 0 ? (
        <Text style={styles.meta}>You have not voted in a council election yet.</Text>
      ) : (
        data.qpunch.map((q, i) => (
          <View key={i} style={styles.row}>
            <Text style={styles.v}>
              {q.year} · {q.sign} · {q.candidate}
            </Text>
            <Text style={[styles.v, { color: q.won ? colors.earth : colors.faint }]}>{q.won ? 'won' : 'lost'}</Text>
          </View>
        ))
      )}
      {msg && <Text style={styles.ok}>{msg}</Text>}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, marginBottom: space.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  meta: { color: colors.dim, fontFamily: fonts.body },
  row: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: colors.panel, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  v: { color: colors.text, fontFamily: fonts.body },
  ok: { color: colors.earth, fontFamily: fonts.medium, marginTop: space.md },
});
