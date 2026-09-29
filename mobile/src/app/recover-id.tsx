/**
 * Forgotten Private ID: never self-service. The request goes to the Founder's
 * team, and the ID is returned only by physical letter (same as the website).
 */

import { useState } from 'react';
import { recoverId } from '@/api/qumanity';
import { Button, ErrorText, Field, Lead, Screen, Title } from '@/components/ui';

export default function RecoverId() {
  const [f, setF] = useState({ name: '', dob: '', birth_country: '', birth_state: '', phone: '', email: '', mailing_address: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [reference, setReference] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const valid = f.name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(f.dob) && f.mailing_address.trim() && (f.phone.trim() || f.email.trim());

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      setReference((await recoverId(f)).reference);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (reference) {
    return (
      <Screen>
        <Title>Request received</Title>
        <Lead>
          Your reference is {reference}. The Founder's team checks every request by hand. If it matches an account, your Private ID is sent
          to you by post, never by SMS or email.
        </Lead>
      </Screen>
    );
  }

  return (
    <Screen footer={<Button title="Send request" onPress={submit} disabled={!valid} busy={busy} />}>
      <Title>Forgot Private ID</Title>
      <Lead>Qumanity never sends a Private ID by SMS or email. Tell us who you are; it is returned by letter.</Lead>
      <Field label="Full name" value={f.name} onChangeText={set('name')} />
      <Field label="Date of birth (YYYY-MM-DD)" value={f.dob} onChangeText={set('dob')} placeholder="1990-08-01" />
      <Field label="Birth country" value={f.birth_country} onChangeText={set('birth_country')} />
      <Field label="Birth state / province" value={f.birth_state} onChangeText={set('birth_state')} />
      <Field label="Phone on the account" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="Email on the account" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Postal address for the letter" value={f.mailing_address} onChangeText={set('mailing_address')} multiline style={{ height: 90 }} />
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}
