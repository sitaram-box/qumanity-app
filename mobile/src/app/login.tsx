/**
 * Sign in: 9-digit Private ID + 5-character PIN (5 wrong PINs lock the ID for 15 minutes, enforced by the website).
 * The website address is not shown or editable here (2026-11-18): the app always talks to
 * https://qumanity.in (development builds: the Mac running the website — api/client.ts). If it
 * can't be reached, signing in says so.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CodeInput } from '@/components/CodeInput';
import { Button, ErrorText, Label, Lead, Logo, Screen, Title } from '@/components/ui';
import { rememberedId, setRememberedId } from '@/lib/remembered';
import { useApp } from '@/state/app';
import { colors, fonts, radius, space } from '@/theme';

export default function Login() {
  const { signIn } = useApp();
  const [privateId, setPrivateId] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [remember, setRemember] = useState(false);

  const digits = privateId.replace(/\D/g, '');
  const valid = digits.length === 9 && pin.length === 5;

  useEffect(() => {
    rememberedId().then((id) => {
      if (id) {
        setPrivateId(id);
        setRemember(true);
      }
    });
  }, []);

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await signIn(digits, pin);
      await setRememberedId(remember ? digits : null);
    } catch (e) {
      setError((e as Error).message);
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={<Button title="Sign in" icon="log-in-outline" onPress={submit} disabled={!valid} busy={busy} />}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.back}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Logo size={44} />
      </View>
      <Title>Welcome back</Title>
      <Lead>Sign in with your 9-digit Private ID and 5-character PIN — the same as on the website.</Lead>

      <Label>Private ID</Label>
      <TextInput
        value={privateId}
        onChangeText={(t) => setPrivateId(t.replace(/[^\d ]/g, '').slice(0, 11))}
        keyboardType="number-pad"
        placeholder="123 456 789"
        placeholderTextColor={colors.faint}
        style={styles.idInput}
        secureTextEntry={false}
        autoComplete="off"
        accessibilityLabel="9-digit Private ID"
      />

      <Label>PIN</Label>
      <CodeInput length={5} secure value={pin} onChange={setPin} autoFocus={false} accessibilityLabel="5-character PIN" />
      <ErrorText>{error}</ErrorText>

      <Pressable
        style={styles.remember}
        onPress={() => setRemember((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: remember }}
        accessibilityLabel="Remember my Private ID on this device"
      >
        <View style={[styles.checkbox, remember && styles.checkboxOn]}>
          {remember && <Ionicons name="checkmark" size={14} color={colors.onAccent} />}
        </View>
        <Text style={styles.rememberText}>Remember my Private ID on this device</Text>
      </Pressable>

      <View style={styles.links}>
        <Pressable onPress={() => router.push('/forgot-pin')} accessibilityRole="button">
          <Text style={styles.link}>Forgot PIN?</Text>
        </Pressable>
        <Pressable onPress={() => router.push('/recover-id')} accessibilityRole="button">
          <Text style={styles.link}>Forgot Private ID?</Text>
        </Pressable>
      </View>
      {/* A parent / child / sibling / spouse on Qumanity vouches for you (PIN, Private ID or both). */}
      <Pressable onPress={() => router.push('/recover-family')} accessibilityRole="button" style={styles.familyLink}>
        <Text style={styles.link}>Recover via a family member</Text>
      </Pressable>

    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.lg },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.panel, alignItems: 'center', justifyContent: 'center' },
  idInput: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontFamily: fonts.bold,
    fontSize: 19,
    letterSpacing: 3,
    marginBottom: space.md,
  },
  remember: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.md },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  rememberText: { color: colors.dim, fontFamily: fonts.body, fontSize: 13 },
  links: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.lg },
  familyLink: { alignSelf: 'center', marginTop: space.md },
  link: { color: colors.gold, fontFamily: fonts.medium, fontSize: 13 },
});
