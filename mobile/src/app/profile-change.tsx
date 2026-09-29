/**
 * Request a profile change (the website's Edit Profile). Name, email and phone are simple changes;
 * date and time of birth are foundational (they set your sign, IDs and elections), so the council
 * decides those. Leave a box empty to keep it as it is.
 */

import { useState } from 'react';
import { Text } from 'react-native';
import * as Q from '@/api/qumanity';
import { BackHeader, Button, ErrorText, Field, Lead, Screen } from '@/components/ui';
import { useApp } from '@/state/app';
import { colors, fonts, space } from '@/theme';

export default function ProfileChange() {
  const { me } = useApp();
  const [f, setF] = useState({ name: '', email: '', phone: '', dob: '', tob: '', reason: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const any = f.name || f.email || f.phone || f.dob || f.tob;

  async function send() {
    if (f.dob && !/^\d{4}-\d{2}-\d{2}$/.test(f.dob)) return setError('Date of birth as YYYY-MM-DD');
    if (f.tob && !/^\d{2}:\d{2}$/.test(f.tob)) return setError('Time of birth as HH:MM');
    setBusy(true);
    setError(undefined);
    try {
      const body = Object.fromEntries(Object.entries(f).filter(([, v]) => v.trim())) as Parameters<typeof Q.requestProfileChange>[0];
      await Q.requestProfileChange({ ...body, reason: f.reason.trim() });
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen footer={!done ? <Button title="Send to the council" icon="send" onPress={send} busy={busy} disabled={!any || !f.reason.trim()} /> : undefined}>
      <BackHeader title="Change my profile" subtitle={me?.name} />
      {done ? (
        <Text style={{ color: colors.earth, fontFamily: fonts.medium, marginTop: space.lg }}>
          Sent. The council reviews your request; you'll see the change once it is approved.
        </Text>
      ) : (
        <>
          <Lead>Fill in only what should change. Date and time of birth set your sign and IDs, so the council checks them first.</Lead>
          <Field label="Name" value={f.name} onChangeText={set('name')} placeholder={me?.name} maxLength={80} />
          <Field label="Email" value={f.email} onChangeText={set('email')} placeholder={me?.email ?? ''} keyboardType="email-address" autoCapitalize="none" />
          <Field label="Phone" value={f.phone} onChangeText={set('phone')} placeholder={me?.phone ?? ''} keyboardType="phone-pad" />
          <Field label="Date of birth (YYYY-MM-DD)" value={f.dob} onChangeText={set('dob')} keyboardType="numbers-and-punctuation" />
          <Field label="Time of birth (HH:MM)" value={f.tob} onChangeText={set('tob')} keyboardType="numbers-and-punctuation" />
          <Field label="Why? (for the council)" value={f.reason} onChangeText={set('reason')} maxLength={200} />
          <ErrorText>{error}</ErrorText>
        </>
      )}
    </Screen>
  );
}
