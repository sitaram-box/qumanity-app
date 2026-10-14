/**
 * Account IDs: one per present-location stay, kept forever. You are in one place at a time, so
 * exactly one is active; switching changes your Public and Global pages to that place at once.
 * Moving somewhere new: request a new Account ID for that place, and the council approves it after
 * checking you are there. (Automatic approval when a local shop confirms you are there is not
 * built yet.)
 */

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { toStruct, type Place } from '@/api/locations';
import * as Q from '@/api/qumanity';
import { LocationPicker } from '@/components/LocationPicker';
import { BackHeader, Button, Card, ErrorText, Lead, Screen, SectionTitle } from '@/components/ui';
import { useApp } from '@/state/app';
import { colors, fonts, radius, space, tint, type } from '@/theme';

const group4 = (s: string) => s.replace(/(\d{4})(?=\d)/g, '$1 ');

export default function AccountIds() {
  const { refreshMe } = useApp();
  const [rows, setRows] = useState<Q.AccountIdRow[] | null>(null);
  const [requests, setRequests] = useState<Q.AccountIdRequest[]>([]);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState<number | 'request' | null>(null);
  const [picking, setPicking] = useState(false);
  const [path, setPath] = useState<Place[]>([]);
  const [complete, setComplete] = useState(false);
  const onComplete = useCallback((v: boolean) => setComplete(v), []);

  const load = useCallback(async () => {
    try {
      const me = await Q.peopleMe();
      setRows(me.account_history);
      setRequests(me.account_requests ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function doSwitch(row: Q.AccountIdRow) {
    setBusy(row.id);
    setError(undefined);
    try {
      await Q.switchAccount(row.id);
      await refreshMe(); // Public and Global pages now follow this place
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  function confirmSwitch(row: Q.AccountIdRow) {
    const where = Q.placeLine(row.present_location_json);
    const text = `Your Public and Global pages will show ${where}.`;
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`Switch Account ID?\n${text}`)) doSwitch(row);
      return;
    }
    Alert.alert('Switch Account ID?', text, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Switch', onPress: () => doSwitch(row) },
    ]);
  }

  async function sendRequest() {
    setBusy('request');
    setError(undefined);
    try {
      await Q.requestNewAccount(toStruct(path));
      setPicking(false);
      setPath([]);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const pending = requests.find((r) => r.status === 'pending');
  const current = rows?.find((r) => r.is_current);
  const others = rows?.filter((r) => !r.is_current) ?? [];

  if (picking) {
    return (
      <Screen
        scroll={false}
        footer={
          <View style={{ gap: space.sm }}>
            <Button title="Send request to the council" icon="send" onPress={sendRequest} disabled={!complete} busy={busy === 'request'} />
            <Button title="Cancel" variant="ghost" onPress={() => setPicking(false)} />
          </View>
        }
      >
        <BackHeader title="New Account ID" subtitle="Where do you live now?" />
        <LocationPicker path={path} onChange={setPath} onlySubcontinent onComplete={onComplete} />
        <ErrorText>{error}</ErrorText>
      </Screen>
    );
  }

  return (
    <Screen>
      <BackHeader title="Account IDs" subtitle="One for every place you have lived" />
      <Lead>You can be in only one place at a time, so one Account ID is active. Your Public and Global pages follow the active one.</Lead>

      {current && (
        <View style={[styles.card, styles.active]}>
          <View style={styles.row}>
            <View style={[styles.badge, { backgroundColor: tint(colors.earth) }]}>
              <Ionicons name="checkmark-circle" size={13} color={colors.earth} />
              <Text style={[styles.badgeText, { color: colors.earth }]}>ACTIVE</Text>
            </View>
            <Text style={type.micro}>since {current.created_at.slice(0, 10)}</Text>
          </View>
          <Text style={styles.place}>{Q.placeLine(current.present_location_json)}</Text>
          <Text style={styles.code}>Search code {group4(current.search_code)}</Text>
        </View>
      )}

      {others.length > 0 && <SectionTitle>Inactive</SectionTitle>}
      {others.map((r) => (
        <Card key={r.id}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.placeSmall}>{Q.placeLine(r.present_location_json)}</Text>
              <Text style={type.micro}>from {r.created_at.slice(0, 10)}</Text>
            </View>
            <Button title="Switch here" size="sm" variant="soft" onPress={() => confirmSwitch(r)} busy={busy === r.id} />
          </View>
        </Card>
      ))}

      <SectionTitle>Moved somewhere new?</SectionTitle>
      {pending ? (
        <Card>
          <Text style={styles.placeSmall}>Waiting for the council: {Q.placeLine(pending.present_location_json)}</Text>
          <Text style={type.small}>Sent {pending.created_at.slice(0, 10)}. The council approves after checking you live there; then it becomes your active Account ID.</Text>
        </Card>
      ) : (
        <>
          <Text style={[type.small, { marginBottom: space.sm }]}>
            Ask for a new Account ID for the place you live now. The council of that place approves it after checking you are there.
          </Text>
          <Button title="Request a new Account ID" icon="add-circle-outline" variant="ghost" onPress={() => setPicking(true)} />
        </>
      )}
      {requests
        .filter((r) => r.status === 'rejected')
        .slice(0, 1)
        .map((r) => (
          <Text key={r.id} style={[type.small, { marginTop: space.sm, color: colors.saffron }]}>
            Your request for {Q.placeLine(r.present_location_json)} was not approved.
          </Text>
        ))}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: space.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, marginBottom: space.md, gap: 4 },
  active: { borderColor: colors.earth },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 11 },
  badgeText: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.5 },
  place: { color: colors.text, fontFamily: fonts.bold, fontSize: 16, marginTop: 4 },
  placeSmall: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  code: { color: colors.dim, fontFamily: fonts.medium, fontSize: 12.5 },
});
