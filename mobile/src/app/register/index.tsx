/** Step 1 · Personal details: name, gender, date & time of birth, mother tongue, optional contact, 5-digit PIN (twice). */

import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LANGUAGE_GROUPS } from '@shared';
import { zodiacPreview } from '@/api/qumanity';
import { CodeInput } from '@/components/CodeInput';
import { Button, Chip, ErrorText, Field, Label, Lead, Screen, Steps, Title } from '@/components/ui';
import { useApp } from '@/state/app';
import { colors, fonts, space } from '@/theme';

const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'both', label: 'Third gender' },
] as const;

const pad = (s: string) => s.padStart(2, '0');
const digits = (max: number) => (t: string) => t.replace(/\D/g, '').slice(0, max);

export default function PersonalDetails() {
  const { draft, setDraft } = useApp();
  const [name, setName] = useState(draft.name);
  const [gender, setGender] = useState(draft.gender);
  const [day, setDay] = useState(draft.dob.slice(8, 10));
  const [month, setMonth] = useState(draft.dob.slice(5, 7));
  const [year, setYear] = useState(draft.dob.slice(0, 4));
  const [hour, setHour] = useState(draft.tob.slice(0, 2));
  const [minute, setMinute] = useState(draft.tob.slice(3, 5));
  const [language, setLanguage] = useState(draft.language);
  const [email, setEmail] = useState(draft.email);
  const [phone, setPhone] = useState(draft.phone);
  const [pin, setPin] = useState(draft.pin);
  const [pin2, setPin2] = useState(draft.pin);
  const [sign, setSign] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const dob = year.length === 4 && month && day ? `${year}-${pad(month)}-${pad(day)}` : '';
  const tob = hour && minute ? `${pad(hour)}:${pad(minute)}` : '';

  const errors: Record<string, string> = {};
  if (name.trim().length < 2) errors.name = 'Enter your full name.';
  if (!gender) errors.gender = 'Choose one.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob)) || dob > new Date().toISOString().slice(0, 10)) errors.dob = 'Enter a valid date of birth.';
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(tob)) errors.tob = 'Enter time of birth as HH:MM (24-hour).';
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'That email does not look right.';
  if (pin.length !== 5) errors.pin = 'Choose a 5-digit PIN.';
  else if (pin2 !== pin) errors.pin = 'The two PINs do not match.';
  const valid = Object.keys(errors).length === 0;
  const show = (k: string) => (touched ? errors[k] : undefined);

  useEffect(() => {
    if (!dob || errors.dob) return setSign(null);
    let live = true;
    zodiacPreview(dob).then(
      (z) => live && setSign(`${z.sign} · ${z.element} · ${z.age_name} (${z.age_range})`),
      () => live && setSign(null),
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dob]);

  function next() {
    setTouched(true);
    if (!valid) return;
    setDraft({ name: name.trim(), gender, dob, tob, language, email: email.trim(), phone: phone.trim(), pin });
    router.push('/register/global');
  }

  return (
    <Screen footer={<Button title="Next · Global account" onPress={next} />}>
      <Steps at={1} of={4} />
      <Title>Personal details</Title>
      <Lead>Your date of birth sets your sun sign, which decides your council voting group.</Lead>

      <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" error={show('name')} />

      <Label>Gender</Label>
      <View style={styles.wrap}>
        {GENDERS.map((g) => (
          <Chip key={g.value} label={g.label} selected={gender === g.value} onPress={() => setGender(g.value)} />
        ))}
      </View>
      <ErrorText>{show('gender')}</ErrorText>

      <View style={styles.row}>
        <Field label="Day" value={day} onChangeText={(t) => setDay(digits(2)(t))} keyboardType="number-pad" placeholder="DD" style={styles.small} />
        <Field label="Month" value={month} onChangeText={(t) => setMonth(digits(2)(t))} keyboardType="number-pad" placeholder="MM" style={styles.small} />
        <Field label="Year of birth" value={year} onChangeText={(t) => setYear(digits(4)(t))} keyboardType="number-pad" placeholder="YYYY" style={styles.year} />
      </View>
      <ErrorText>{show('dob')}</ErrorText>
      {sign && <Text style={styles.sign}>{sign}</Text>}

      <View style={styles.row}>
        <Field label="Hour of birth" value={hour} onChangeText={(t) => setHour(digits(2)(t))} keyboardType="number-pad" placeholder="HH" style={styles.small} />
        <Field label="Minute" value={minute} onChangeText={(t) => setMinute(digits(2)(t))} keyboardType="number-pad" placeholder="MM" style={styles.small} />
      </View>
      <ErrorText>{show('tob')}</ErrorText>

      <Label>Mother tongue</Label>
      {LANGUAGE_GROUPS.map((g) => (
        <View key={g.key} style={{ marginBottom: space.sm }}>
          <Text style={styles.group}>{g.label}</Text>
          <View style={styles.wrap}>
            {g.languages.map((l) => (
              <Chip key={l.name} label={l.native === l.name ? l.name : `${l.native} · ${l.name}`} selected={language === l.name} onPress={() => setLanguage(l.name)} />
            ))}
          </View>
        </View>
      ))}

      <Field label="Phone (optional, for PIN recovery)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Email (optional, for PIN recovery)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={show('email')} />

      <Label>Choose a 5-digit PIN</Label>
      <CodeInput length={5} secure value={pin} onChange={setPin} autoFocus={false} accessibilityLabel="New PIN" />
      <Label>Type the PIN again</Label>
      <CodeInput length={5} secure value={pin2} onChange={setPin2} autoFocus={false} accessibilityLabel="Confirm PIN" />
      <ErrorText>{show('pin')}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  row: { flexDirection: 'row', gap: space.md },
  small: { width: 76, textAlign: 'center' },
  year: { width: 110, textAlign: 'center' },
  sign: { color: colors.gold, fontFamily: fonts.medium, marginBottom: space.lg },
  group: { color: colors.faint, fontFamily: fonts.medium, fontSize: 12, marginBottom: space.sm, textTransform: 'uppercase', letterSpacing: 1 },
});
