/** Settings: daily-use language (3rd language), change PIN, server address, sign out. */

import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LANGUAGE_GROUPS } from '@shared';
import { changePin, setDailyLanguage, setPreferredLanguage } from '@/api/qumanity';
import { CodeInput } from '@/components/CodeInput';
import { BackHeader, Button, Chip, ErrorText, Label, Screen, ListRow } from '@/components/ui';
import { useApp } from '@/state/app';
import { colors, fonts, radius, space } from '@/theme';

export default function Settings() {
  const { me, refreshMe, acceptToken, signOut, server } = useApp();
  const [langMsg, setLangMsg] = useState<string>();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [pinMsg, setPinMsg] = useState<string>();
  const [pinErr, setPinErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (!me) return null;

  async function pickDaily(name: string) {
    setLangMsg(undefined);
    try {
      await setDailyLanguage(me!.daily_language === name ? '' : name);
      await refreshMe();
    } catch (e) {
      setLangMsg((e as Error).message);
    }
  }

  async function pickPreferred(code: string) {
    setLangMsg(undefined);
    try {
      await setPreferredLanguage(code);
      await refreshMe();
    } catch (e) {
      setLangMsg((e as Error).message);
    }
  }

  async function savePin() {
    setPinErr(undefined);
    setPinMsg(undefined);
    if (next !== again) return setPinErr('The new PINs do not match.');
    setBusy(true);
    try {
      const { token } = await changePin(current, next);
      await acceptToken(token);
      setCurrent('');
      setNext('');
      setAgain('');
      setPinMsg('PIN changed. Use it on the website too.');
    } catch (e) {
      setPinErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const choices = LANGUAGE_GROUPS.flatMap((g) => g.languages).filter((l) => l.name !== 'English' && l.name !== me.mother_tongue);

  return (
    <Screen>
      <BackHeader title="Settings" />

      <View style={styles.card}>
        <Label>Languages</Label>
        <Text style={styles.meta}>
          Mother tongue {me.mother_tongue} · English{me.daily_language ? ` · ${me.daily_language}` : ''}
        </Text>
        <Text style={[styles.meta, { marginBottom: space.sm }]}>Add one language you use every day (tap again to remove):</Text>
        <View style={styles.wrap}>
          {choices.map((l) => (
            <Chip key={l.name} label={l.native === l.name ? l.name : `${l.native} · ${l.name}`} selected={me.daily_language === l.name} onPress={() => pickDaily(l.name)} />
          ))}
        </View>
        <Text style={[styles.meta, { marginTop: space.md, marginBottom: space.sm }]}>
          Preferred language — the website shows itself in this language (saved to your account, so it follows you):
        </Text>
        <View style={styles.wrap}>
          {me.languages.map((l) => (
            <Chip key={l.code} label={l.native} selected={(me.preferred_language || 'en') === l.code} onPress={() => pickPreferred(l.code)} />
          ))}
        </View>
        <ErrorText>{langMsg}</ErrorText>
      </View>

      <View style={styles.card}>
        <Label>Change PIN</Label>
        <Text style={styles.meta}>Current PIN</Text>
        <CodeInput length={5} secure value={current} onChange={setCurrent} autoFocus={false} accessibilityLabel="Current PIN" />
        <Text style={styles.meta}>New PIN</Text>
        <CodeInput length={5} secure value={next} onChange={setNext} autoFocus={false} accessibilityLabel="New PIN" />
        <Text style={styles.meta}>New PIN again</Text>
        <CodeInput length={5} secure value={again} onChange={setAgain} autoFocus={false} accessibilityLabel="New PIN again" />
        <ErrorText>{pinErr}</ErrorText>
        {pinMsg && <Text style={styles.ok}>{pinMsg}</Text>}
        <Button title="Change PIN" variant="ghost" onPress={savePin} busy={busy} disabled={current.length !== 5 || next.length !== 5 || again.length !== 5} style={{ marginTop: space.md }} />
      </View>

      <View style={styles.card}>
        <Label>Recovery</Label>
        <Text style={styles.meta}>
          Forgot your PIN? Sign out and use “Forgot PIN” — a code goes to the phone or email on your account. A forgotten Private ID is only ever
          returned by post, after a check by the Founder's team.
        </Text>
        <Text style={[styles.meta, { marginTop: space.md }]}>Website: {server}</Text>
      </View>

      {me.is_admin && (
        <ListRow icon="shield-checkmark" accent={colors.violet} title="Council approvals" subtitle="New Account IDs · public reviews" onPress={() => router.push('/council')} />
      )}
      <ListRow icon="play-circle" accent={colors.gold} title="App tour" subtitle="See how Qumanity works again" onPress={() => router.push({ pathname: '/tour', params: { replay: '1' } })} />
      <Button title="Sign out" variant="ghost" onPress={signOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: space.lg, marginBottom: space.md },
  meta: { color: colors.dim, fontFamily: fonts.body, fontSize: 13, marginTop: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap' },
  ok: { color: colors.earth, fontFamily: fonts.medium, marginTop: space.sm },
});
