/**
 * Forgotten Private ID -- 3 tabs (2026-11-25 mobile redesign Step 4, mirroring the website's own
 * rebuilt /recover-id): PIN lookup and Family OTP are new, self-service, instant; Mail-a-letter is
 * the original flow (recoverId(), unchanged below) kept as the third tab. "Recover via a family
 * member instead" (the Family TREE graph path, recover-family.tsx -- a different mechanism from
 * the new Family OTP tab: that one resolves a REQUESTER by searching a relative's claimed tree
 * node by name, this one just sends an OTP to a relative's phone) stays a persistent link below
 * every tab, same as it always was.
 */

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { allCountries } from '@/api/locations';
import { recoverId, recoverIdByFamilyOtp, recoverIdByPin, verifyFamilyOtp } from '@/api/qumanity';
import { Button, Chip, ErrorText, Field, Lead, Screen, Title } from '@/components/ui';
import { CodeInput } from '@/components/CodeInput';
import { SelectField, type SelectOption } from '@/components/SelectField';
import { colors, fonts, space } from '@/theme';

type Tab = 'pin' | 'otp' | 'letter';

export default function RecoverId() {
  const [tab, setTab] = useState<Tab>('pin');
  const [countries, setCountries] = useState<SelectOption[]>([]);

  useEffect(() => {
    allCountries().then(
      (list) => setCountries(list.map((c) => ({ value: c.id, label: c.name }))),
      () => undefined,
    );
  }, []);

  return (
    <Screen footer={<Button title="Recover via a family member instead" variant="ghost" size="sm" onPress={() => router.push('/recover-family')} />}>
      <Title>Forgot Private ID</Title>
      <Lead>Three ways to recover it, depending on what you still remember.</Lead>

      <View style={styles.tabs}>
        <Chip label="I know my PIN" selected={tab === 'pin'} onPress={() => setTab('pin')} />
        <Chip label="Family OTP" selected={tab === 'otp'} onPress={() => setTab('otp')} />
        <Chip label="Mail a letter" selected={tab === 'letter'} onPress={() => setTab('letter')} />
      </View>

      {tab === 'pin' && <PinLookupTab countries={countries} />}
      {tab === 'otp' && <FamilyOtpTab countries={countries} />}
      {tab === 'letter' && <MailLetterTab />}
    </Screen>
  );
}

// ---- Tab 1: PIN lookup (self-service, instant) ----
function PinLookupTab({ countries }: { countries: SelectOption[] }) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [countryId, setCountryId] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [revealed, setRevealed] = useState<string>();
  const valid = name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(dob) && countryId && pin.length === 5;

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      const r = await recoverIdByPin(name.trim(), dob, countryId, pin);
      setRevealed(r.private_id_9digit);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (revealed) return <Revealed id={revealed} />;

  return (
    <>
      <Field label="Full name (as you registered it)" value={name} onChangeText={setName} />
      <Field label="Date of birth (YYYY-MM-DD)" value={dob} onChangeText={setDob} placeholder="1990-08-01" />
      <SelectField label="Birth country" value={countryId} options={countries} onChange={setCountryId} placeholder="Choose your birth country" searchable />
      <Field label="PIN" value={pin} onChangeText={setPin} secureTextEntry maxLength={5} />
      <ErrorText>{error}</ErrorText>
      <Button title="Find my Private ID" onPress={submit} disabled={!valid} busy={busy} />
    </>
  );
}

// ---- Tab 2: Family OTP (self-service, "I forgot everything") ----
function FamilyOtpTab({ countries }: { countries: SelectOption[] }) {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [countryId, setCountryId] = useState('');
  const [phone, setPhone] = useState('');
  const [sentTo, setSentTo] = useState<string>();
  const [devCode, setDevCode] = useState<string>();
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [revealed, setRevealed] = useState<string>();
  const requestValid = name.trim() && /^\d{4}-\d{2}-\d{2}$/.test(dob) && countryId && phone.trim();

  async function requestOtp() {
    setBusy(true);
    setError(undefined);
    try {
      const r = await recoverIdByFamilyOtp(name.trim(), dob, countryId, phone.trim());
      setSentTo(r.masked_target);
      setDevCode(r.dev_code);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(undefined);
    try {
      const r = await verifyFamilyOtp(name.trim(), dob, countryId, phone.trim(), otp);
      setRevealed(r.private_id_9digit);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (revealed) return <Revealed id={revealed} />;

  return (
    <>
      <Text style={styles.note}>
        For when you've forgotten both your Private ID and your PIN. We'll send a one-time code to a parent, child, sibling, or spouse's phone who is
        already a verified family member on your Family Tree -- not to you.
      </Text>
      {!sentTo ? (
        <>
          <Field label="Your full name (as you registered it)" value={name} onChangeText={setName} />
          <Field label="Your date of birth (YYYY-MM-DD)" value={dob} onChangeText={setDob} placeholder="1990-08-01" />
          <SelectField label="Your birth country" value={countryId} options={countries} onChange={setCountryId} placeholder="Choose your birth country" searchable />
          <Field label="That family member's phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="parent / child / sibling / spouse" />
          <ErrorText>{error}</ErrorText>
          <Button title="Send OTP" onPress={requestOtp} disabled={!requestValid} busy={busy} />
        </>
      ) : (
        <>
          <Text style={styles.sent}>If those details matched, we sent a code to {sentTo}.</Text>
          {devCode && <Text style={styles.dev}>Testing: no SMS service is connected yet, so the code is shown here: {devCode}</Text>}
          <Text style={styles.note}>Ask that family member for the code, then enter it below.</Text>
          <CodeInput length={6} value={otp} onChange={setOtp} accessibilityLabel="OTP" />
          <ErrorText>{error}</ErrorText>
          <Button title="Verify" onPress={verify} disabled={otp.length < 4} busy={busy} />
        </>
      )}
    </>
  );
}

// ---- Tab 3: Mail a letter (the original flow, unchanged behavior) ----
function MailLetterTab() {
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
      <Lead>
        Your reference is {reference}. The Founder's team checks every request by hand. If it matches an account, your Private ID is sent to you by
        post, never by SMS or email.
      </Lead>
    );
  }

  return (
    <>
      <Text style={styles.note}>Qumanity never sends a Private ID by SMS or email this way. Tell us who you are; it is returned by letter.</Text>
      <Field label="Full name" value={f.name} onChangeText={set('name')} />
      <Field label="Date of birth (YYYY-MM-DD)" value={f.dob} onChangeText={set('dob')} placeholder="1990-08-01" />
      <Field label="Birth country" value={f.birth_country} onChangeText={set('birth_country')} />
      <Field label="Birth state / province" value={f.birth_state} onChangeText={set('birth_state')} />
      <Field label="Phone on the account" value={f.phone} onChangeText={set('phone')} keyboardType="phone-pad" />
      <Field label="Email on the account" value={f.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" />
      <Field label="Postal address for the letter" value={f.mailing_address} onChangeText={set('mailing_address')} multiline style={{ height: 90 }} />
      <ErrorText>{error}</ErrorText>
      <Button title="Send request" onPress={submit} disabled={!valid} busy={busy} />
    </>
  );
}

function Revealed({ id }: { id: string }) {
  return (
    <View>
      <Text style={styles.note}>✅ Your Private ID is:</Text>
      <Text style={styles.revealed}>{id}</Text>
      <Text style={styles.note}>Use it with your PIN to sign in.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: space.sm, marginBottom: space.md, flexWrap: 'wrap' },
  note: { color: colors.dim, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginBottom: space.md },
  sent: { color: colors.text, fontFamily: fonts.medium, marginBottom: space.sm },
  dev: { color: colors.gold, fontFamily: fonts.body, fontSize: 13, marginBottom: space.md },
  revealed: { color: colors.gold, fontFamily: fonts.bold, fontSize: 24, letterSpacing: 1, marginVertical: space.sm },
});
