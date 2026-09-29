/**
 * Council approvals (admin / council only): new Account ID requests — approve after checking the
 * person lives there — and member reviews the member allowed to be shown publicly.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { BackHeader, Button, Card, ErrorText, Screen, SectionTitle } from '@/components/ui';
import { colors, fonts, space, type } from '@/theme';

export default function Council() {
  const [accounts, setAccounts] = useState<Q.AdminAccountRequest[] | null>(null);
  const [reviews, setReviews] = useState<Q.AdminReview[] | null>(null);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [a, r] = await Promise.all([Q.adminAccountRequests(), Q.adminReviews()]);
      setAccounts(a.requests);
      setReviews(r.reviews);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const act = (key: string, fn: () => Promise<unknown>) => async () => {
    setBusy(key);
    setError(undefined);
    try {
      await fn();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const publicAsks = reviews?.filter((r) => r.allow_public && r.text) ?? [];
  const average = reviews?.length ? reviews.reduce((n, r) => n + r.rating, 0) / reviews.length : null;

  return (
    <Screen>
      <BackHeader title="Council approvals" subtitle="Account IDs and public reviews" />
      <ErrorText>{error}</ErrorText>

      <SectionTitle>New Account ID requests</SectionTitle>
      {accounts?.length === 0 && <Text style={type.small}>Nothing waiting.</Text>}
      {accounts?.map((a) => (
        <Card key={a.id}>
          <Text style={styles.name}>{a.name}</Text>
          <Text style={type.small}>Now living in {Q.placeLine(a.present_location_json)}</Text>
          <Text style={type.micro}>Asked {a.created_at.slice(0, 10)}</Text>
          <View style={styles.actions}>
            <Button title="Approve" size="sm" icon="checkmark" onPress={act(`a${a.id}`, () => Q.decideAccountRequest(a.id, true))} busy={busy === `a${a.id}`} style={{ flex: 1 }} />
            <Button title="Reject" size="sm" variant="ghost" onPress={act(`r${a.id}`, () => Q.decideAccountRequest(a.id, false))} busy={busy === `r${a.id}`} style={{ flex: 1 }} />
          </View>
        </Card>
      ))}

      <SectionTitle right={average !== null ? <Text style={type.small}>★ {average.toFixed(1)} · {reviews!.length}</Text> : undefined}>
        Reviews for the home page
      </SectionTitle>
      {publicAsks.length === 0 && <Text style={type.small}>No member has offered a public review yet.</Text>}
      {publicAsks.map((r) => (
        <Card key={r.id}>
          <Text style={styles.stars}>{'★'.repeat(r.rating)}<Text style={{ color: colors.faint }}>{'★'.repeat(5 - r.rating)}</Text></Text>
          <Text style={type.body}>“{r.text}”</Text>
          <Text style={type.micro}>
            {r.name}
            {r.place ? ` · ${r.place}` : ''} · {r.at.slice(0, 10)}
          </Text>
          <View style={styles.actions}>
            {r.approved ? (
              <Button title="Hide from home page" size="sm" variant="ghost" onPress={act(`h${r.id}`, () => Q.approveReview(r.id, false))} busy={busy === `h${r.id}`} style={{ flex: 1 }} />
            ) : (
              <Button title="Show on home page" size="sm" icon="eye" onPress={act(`s${r.id}`, () => Q.approveReview(r.id, true))} busy={busy === `s${r.id}`} style={{ flex: 1 }} />
            )}
          </View>
        </Card>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  name: { color: colors.text, fontFamily: fonts.bold, fontSize: 15 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  stars: { color: colors.gold, fontSize: 14 },
});
