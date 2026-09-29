/** Forgotten PIN: a one-time code to the phone or email already on the account, then a new PIN. */

import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { requestPinReset, verifyPinReset } from '@/api/qumanity';
import { CodeInput } from '@/components/CodeInput';
import { Button, Chip, ErrorText, Field, Label, Lead, Screen, Title } from '@/components/ui';
import { colors, fonts, space } from '@/theme';

export default function ForgotPin() {
  const [privateId, setPrivateId] = useState('');
  const [channel, setChannel] = useState<'phone' | 'email'>('phone');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [devCode, setDevCode] = useState<string>();
  const [otp, setOtp] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const id = privateId.replace(/\D/g, '');

  async function send() {
    setBusy(true);
    setError(undefined);
    try {
      const r = await requestPinReset(id, channel);
      setSentTo(r.masked_target);
      setDevCode(r.dev_code);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setBusy(true);
    setError(undefined);
    try {
      await verifyPinReset(id, otp, pin);
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <Screen footer={<Button title="Sign in" onPress={() => router.replace('/login')} />}>
        <Title>PIN changed</Title>
        <Lead>Sign in with your Private ID and your new PIN.</Lead>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        sentTo ? (
          <Button title="Set new PIN" onPress={reset} disabled={otp.length < 4 || pin.length !== 5} busy={busy} />
        ) : (
          <Button title="Send code" onPress={send} disabled={id.length !== 9} busy={busy} />
        )
      }
    >
      <Title>Forgot PIN</Title>
      <Lead>We send a one-time code to the phone or email already saved on your account.</Lead>
      {!sentTo ? (
        <>
          <Field label="Private ID" value={privateId} onChangeText={setPrivateId} keyboardType="number-pad" placeholder="9 digits" />
          <Label>Send the code by</Label>
          <View style={{ flexDirection: 'row' }}>
            <Chip label="Phone" selected={channel === 'phone'} onPress={() => setChannel('phone')} />
            <Chip label="Email" selected={channel === 'email'} onPress={() => setChannel('email')} />
          </View>
        </>
      ) : (
        <>
          <Text style={styles.sent}>Code sent to {sentTo}.</Text>
          {devCode && <Text style={styles.dev}>Testing: no SMS/email service is connected yet, so the code is shown here: {devCode}</Text>}
          <Field label="Code" value={otp} onChangeText={setOtp} keyboardType="number-pad" />
          <Label>New 5-digit PIN</Label>
          <CodeInput length={5} secure value={pin} onChange={setPin} autoFocus={false} accessibilityLabel="New PIN" />
        </>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  sent: { color: colors.text, fontFamily: fonts.medium, marginBottom: space.md },
  dev: { color: colors.gold, fontFamily: fonts.body, fontSize: 13, marginBottom: space.lg },
});
