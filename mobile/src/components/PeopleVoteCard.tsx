/**
 * People's Vote (website election_core, "Upper House Sovereignty"): a referendum the people living
 * at a location can hold on any question, at any level — village included. While it's open, the
 * Upper House (everyone living here) votes Yes / No once; the counts stay hidden until it closes,
 * then the result shows (passed at 51% of ballots; a passed vote binds the Q-Punch council).
 * Nothing is shown when there's no vote at this location. Same data and rules as the website's
 * board.js (peopleVoteBlock); starting a new vote is left to the website for now.
 */

import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { colors, fonts, radius, space } from '@/theme';
import { Button, ErrorText } from './ui';

export function PeopleVoteCard({ level, locationId }: { level: Q.BoardLevel; locationId: string }) {
  const [data, setData] = useState<{ vote: Q.PeopleVote | null; is_upper_house: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const load = useCallback(() => {
    Q.peopleVoteStatus(level, locationId).then(setData, () => setData(null)); // no card if it can't be read
  }, [level, locationId]);
  useEffect(load, [load]);

  const vote = data?.vote;
  if (!vote) return null;

  function cast(inFavour: boolean) {
    const go = async () => {
      setBusy(true);
      setError(undefined);
      try {
        await Q.peopleVoteCast(vote!.id, inFavour);
        load();
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    };
    const title = `Vote ${inFavour ? 'Yes' : 'No'}?`;
    const text = `“${vote!.title}” — you can vote only once.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`${title}\n${text}`)) go();
      return;
    }
    Alert.alert(title, text, [
      { text: 'Cancel', style: 'cancel' },
      { text: inFavour ? 'Yes' : 'No', onPress: go },
    ]);
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>📢 People's Vote: {vote.title}</Text>
      {!!vote.description && <Text style={styles.body}>{vote.description}</Text>}
      {vote.status === 'open' ? (
        <>
          <Text style={styles.meta}>Open until {vote.end_time} — counts stay hidden until it closes.</Text>
          {data?.is_upper_house && !vote.already_voted ? (
            <View style={styles.actions}>
              <Button title="Yes" icon="checkmark" size="sm" onPress={() => cast(true)} busy={busy} style={{ flex: 1 }} />
              <Button title="No" icon="close" size="sm" variant="ghost" onPress={() => cast(false)} disabled={busy} style={{ flex: 1 }} />
            </View>
          ) : (
            <Text style={styles.meta}>{vote.already_voted ? "✓ You've voted." : "Open to this location's own residents only."}</Text>
          )}
        </>
      ) : (
        <Text style={[styles.result, { color: vote.status === 'passed' ? colors.earth : colors.danger }]}>
          {vote.status === 'passed' ? '✅ Passed' : '❌ Failed'} — {vote.votes_for ?? 0} for, {vote.votes_against ?? 0} against.
          {vote.status === 'passed' ? ' Binding on the Q-Punch council.' : ''}
        </Text>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panel, borderRadius: radius.md, padding: space.md, gap: 6, marginTop: space.md },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 14.5 },
  body: { color: colors.text, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },
  meta: { color: colors.dim, fontFamily: fonts.body, fontSize: 12.5 },
  result: { fontFamily: fonts.medium, fontSize: 13.5 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: 4 },
});
