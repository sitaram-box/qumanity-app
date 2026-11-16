/**
 * Recover via a family member (signed out). A nuclear family member already on Qumanity — parent,
 * child, brother/sister, husband/wife — vouches for you (website family_recovery_core):
 *
 *   1. Form: what you need back (PIN / Private ID / both), your full name, their full name and
 *      Private ID, and who they are to you. The website checks all of it against the Family Tree;
 *      on ANY mismatch it answers with one deliberately vague message (it never says which detail
 *      was wrong), and only 3 attempts per day are allowed. Its message is shown as-is.
 *   2. A tracking code comes back — the only key to this request. It's shown once with a copy
 *      button and saved in the phone's secure storage, so closing the app doesn't lose it.
 *   3. Status: waiting / approved / declined / expired. Once approved: set a new PIN (within 24
 *      hours); once your Private ID is shared (or after the new PIN, if you asked for both): see it.
 *
 * The family member sees the request on their Notifications screen (Approve / Deny).
 */

import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { CodeInput } from '@/components/CodeInput';
import { ACTIONS, RELATIONSHIPS, buildRequest, canSend, statusView, type RecoveryForm } from '@/components/familyRecovery.logic';
import { PIN_HINT } from '@/components/pin.logic';
import { BackHeader, Button, Chip, ErrorText, Field, Label, Lead, Screen } from '@/components/ui';
import { colors, fonts, radius, space, type } from '@/theme';

/** The saved tracking code (secure storage on the phone; the browser's storage on web). */
const KEY = 'qm.familyRecovery';
async function loadCode(): Promise<string | null> {
  try {
    return Platform.OS === 'web' ? (globalThis.localStorage?.getItem(KEY) ?? null) : await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}
async function saveCode(code: string | null) {
  try {
    if (Platform.OS === 'web') {
      if (code === null) globalThis.localStorage?.removeItem(KEY);
      else globalThis.localStorage?.setItem(KEY, code);
    } else if (code === null) await SecureStore.deleteItemAsync(KEY);
    else await SecureStore.setItemAsync(KEY, code);
  } catch {
    // Storage can fail; the code is still on screen to copy.
  }
}

const EMPTY: RecoveryForm = { action: null, yourName: '', yourPrivateId: '', theirName: '', theirPrivateId: '', relationship: null };

export default function RecoverFamily() {
  const [mode, setMode] = useState<'form' | 'track'>('form');
  const [form, setForm] = useState<RecoveryForm>(EMPTY);
  const [code, setCode] = useState('');
  const [justSent, setJustSent] = useState(false);
  const [status, setStatus] = useState<Q.FamilyRecoveryStatus | null>(null);
  const [privateId, setPrivateId] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [pinDone, setPinDone] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const set = (patch: Partial<RecoveryForm>) => setForm((f) => ({ ...f, ...patch }));

  const check = useCallback(async (c: string) => {
    if (!c.trim()) return;
    setBusy(true);
    setError(undefined);
    try {
      setStatus(await Q.familyRecoveryStatus(c.trim()));
    } catch (e) {
      setStatus(null);
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, []);

  // A request already in progress on this phone: go straight to its status.
  useEffect(() => {
    loadCode().then((c) => {
      if (!c) return;
      setCode(c);
      setMode('track');
      check(c);
    });
  }, [check]);

  async function send() {
    setBusy(true);
    setError(undefined);
    try {
      const r = await Q.familyRecoveryRequest(buildRequest(form));
      await saveCode(r.tracking_code);
      setCode(r.tracking_code);
      setJustSent(true);
      setStatus({ status: 'pending', action: form.action!, expires_at: r.expires_at });
      setMode('track');
    } catch (e) {
      setError((e as Error).message); // deliberately vague when the details don't match; or "too many attempts"
    } finally {
      setBusy(false);
    }
  }

  async function reveal() {
    setBusy(true);
    setError(undefined);
    try {
      setPrivateId((await Q.familyRecoveryRevealPrivateId(code.trim())).private_id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function setNewPin() {
    setBusy(true);
    setError(undefined);
    try {
      await Q.familyRecoveryCompletePinReset(code.trim(), pin);
      setPin('');
      setPinDone(true);
      await check(code); // asked for both: the Private ID is now available too
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    Clipboard.setStringAsync(text).then(() => setCopied(text), () => undefined);
  }

  async function startOver() {
    await saveCode(null);
    setForm(EMPTY);
    setCode('');
    setStatus(null);
    setPrivateId(null);
    setPinDone(false);
    setJustSent(false);
    setError(undefined);
    setMode('form');
  }

  if (mode === 'form') {
    return (
      <Screen footer={<Button title="Send request" icon="send" onPress={send} disabled={!canSend(form)} busy={busy} />}>
        <BackHeader title="Recover via a family member" />
        <Lead>
          A parent, child, brother or sister, or husband or wife who is already on Qumanity can confirm it's you. Type everything exactly as it
          is on your accounts.
        </Lead>

        <Label>What do you need back?</Label>
        <View style={styles.chips}>
          {ACTIONS.map((a) => (
            <Chip key={a.value} label={a.label} selected={form.action === a.value} onPress={() => set({ action: a.value })} />
          ))}
        </View>

        <Field label="Your full name" value={form.yourName} onChangeText={(t) => set({ yourName: t })} autoCapitalize="words" maxLength={80} />
        {form.action === 'pin_reset' && (
          <Field
            label="Your Private ID (if you know it)"
            value={form.yourPrivateId}
            onChangeText={(t) => set({ yourPrivateId: t })}
            keyboardType="number-pad"
            placeholder="9 digits"
            maxLength={11}
          />
        )}

        <Field label="Your family member's full name" value={form.theirName} onChangeText={(t) => set({ theirName: t })} autoCapitalize="words" maxLength={80} />
        <Field
          label="Your family member's Private ID"
          value={form.theirPrivateId}
          onChangeText={(t) => set({ theirPrivateId: t })}
          keyboardType="number-pad"
          placeholder="9 digits"
          maxLength={11}
        />

        <Label>Who are they to you?</Label>
        <View style={styles.chips}>
          {RELATIONSHIPS.map((r) => (
            <Chip key={r.value} label={r.label} selected={form.relationship === r.value} onPress={() => set({ relationship: r.value })} />
          ))}
        </View>
        <Text style={type.small}>Only 3 attempts a day are allowed, so check the details before you send.</Text>

        <ErrorText>{error}</ErrorText>
        <Pressable onPress={() => setMode('track')} accessibilityRole="button" style={styles.linkRow}>
          <Text style={styles.link}>I already have a tracking code</Text>
        </Pressable>
      </Screen>
    );
  }

  const view = status ? statusView(status) : null;
  return (
    <Screen>
      <BackHeader title="Recover via a family member" />

      {justSent && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Request sent</Text>
          <Text style={styles.body}>Your request has been sent to your family member. They will receive a notification to approve it.</Text>
          <Text style={styles.codeLabel}>Your tracking code</Text>
          <Text style={styles.code} selectable>
            {code}
          </Text>
          <Button title={copied === code ? 'Copied' : 'Copy code'} icon={copied === code ? 'checkmark' : 'copy-outline'} variant="soft" size="sm" onPress={() => copy(code)} />
          <Text style={styles.warn}>Keep this code. It is your only way to check the status. It is also saved on this phone.</Text>
        </View>
      )}

      {!justSent && (
        <>
          <Field label="Tracking code" value={code} onChangeText={setCode} autoCapitalize="none" autoCorrect={false} />
          <Button title="Check status" icon="refresh" variant="soft" onPress={() => check(code)} busy={busy} disabled={!code.trim()} />
        </>
      )}

      {view && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{pinDone && view.next !== 'reveal' ? 'Your new PIN is set' : view.title}</Text>
          <Text style={styles.body}>{pinDone && view.next !== 'reveal' ? 'Sign in with your Private ID and your new PIN.' : view.text}</Text>

          {view.next === 'wait' && justSent && (
            <Button title="Check status" icon="refresh" variant="soft" size="sm" onPress={() => check(code)} busy={busy} />
          )}

          {view.next === 'set_pin' && (
            <>
              <Label>New 5-character PIN</Label>
              <Text style={type.small}>{PIN_HINT}</Text>
              <CodeInput length={5} secure value={pin} onChange={setPin} autoFocus={false} accessibilityLabel="New PIN" />
              <Button title="Set new PIN" onPress={setNewPin} disabled={pin.length !== 5} busy={busy} />
            </>
          )}

          {view.next === 'reveal' &&
            (privateId ? (
              <>
                <Text style={styles.codeLabel}>Your Private ID</Text>
                <Text style={styles.code} selectable>
                  {privateId}
                </Text>
                <Button
                  title={copied === privateId ? 'Copied' : 'Copy Private ID'}
                  icon={copied === privateId ? 'checkmark' : 'copy-outline'}
                  variant="soft"
                  size="sm"
                  onPress={() => copy(privateId)}
                />
                <Text style={styles.warn}>Keep it private. Anyone with your Private ID and PIN can sign in as you.</Text>
              </>
            ) : (
              <Button title="Show my Private ID" icon="eye-outline" onPress={reveal} busy={busy} />
            ))}

          {(view.next === 'done' || privateId || pinDone) && (
            <Button title="Sign in" icon="log-in-outline" onPress={() => router.replace('/login')} />
          )}
          {(view.next === 'restart' || view.next === 'done' || privateId) && (
            <Button title={view.next === 'restart' ? 'Start a new request' : 'Forget this tracking code'} variant="ghost" size="sm" onPress={startOver} />
          )}
        </View>
      )}

      <ErrorText>{error}</ErrorText>
      {view?.next === 'wait' && (
        <Pressable onPress={startOver} accessibilityRole="button" style={styles.linkRow}>
          <Text style={styles.link}>Send a new request instead</Text>
        </Pressable>
      )}
      {!view && (
        <Pressable onPress={startOver} accessibilityRole="button" style={styles.linkRow}>
          <Text style={styles.link}>Back to the request form</Text>
        </Pressable>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.md },
  card: { backgroundColor: colors.panel, borderRadius: radius.md, padding: space.lg, gap: space.sm, marginTop: space.md },
  cardTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  body: { color: colors.dim, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  codeLabel: { color: colors.faint, fontFamily: fonts.medium, fontSize: 12, marginTop: space.sm },
  code: { color: colors.gold, fontFamily: fonts.bold, fontSize: 18, letterSpacing: 1 },
  warn: { color: colors.gold, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18 },
  linkRow: { paddingVertical: space.md, alignSelf: 'center' },
  link: { color: colors.gold, fontFamily: fonts.medium, fontSize: 14 },
});
