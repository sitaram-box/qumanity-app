/** Step 1 · Personal details: name, gender, date & time of birth (12-hour with AM/PM, sent to the
 * website as 24-hour HH:MM; or "don't remember"), mother tongue and an optional private Spiritual
 * path (each chosen from a list), optional contact, 5-character PIN (twice). */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LANGUAGE_GROUPS } from '@shared';
import { zodiacPreview } from '@/api/qumanity';
import { CodeInput } from '@/components/CodeInput';
import { Button, Chip, ErrorText, Field, Label, Lead, Screen, Steps, Title } from '@/components/ui';
import { useApp } from '@/state/app';
import { colors, fonts, space, type } from '@/theme';
import { PIN_HINT } from '@/components/pin.logic';
import { RELIGIONS, from24h, to24h, type Religion } from '@/components/registration.logic';
import { SelectField } from '@/components/SelectField';

// Mother tongue choices, grouped as before (each shown in its own script where that differs).
const LANGUAGE_OPTIONS = LANGUAGE_GROUPS.flatMap((g) =>
  g.languages.map((l) => ({ value: l.name, label: l.native === l.name ? l.name : `${l.native} · ${l.name}`, group: g.label })),
);
const RELIGION_OPTIONS = RELIGIONS.map((r) => ({ value: r.value, label: r.label }));

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
  const [middleName, setMiddleName] = useState(draft.middleName);
  const [gender, setGender] = useState(draft.gender);
  const [day, setDay] = useState(draft.dob.slice(8, 10));
  const [month, setMonth] = useState(draft.dob.slice(5, 7));
  const [year, setYear] = useState(draft.dob.slice(0, 4));
  const savedTime = from24h(draft.tob);
  const [hour, setHour] = useState(savedTime.hour);
  const [minute, setMinute] = useState(savedTime.minute);
  const [period, setPeriod] = useState<'AM' | 'PM' | null>(savedTime.period);
  const [tobUnknown, setTobUnknown] = useState(draft.tobUnknown);
  const [religion, setReligion] = useState<Religion>(draft.religion);
  const [language, setLanguage] = useState(draft.language);
  const [email, setEmail] = useState(draft.email);
  const [phone, setPhone] = useState(draft.phone);
  const [pin, setPin] = useState(draft.pin);
  const [pin2, setPin2] = useState(draft.pin);
  const [sign, setSign] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const dob = year.length === 4 && month && day ? `${year}-${pad(month)}-${pad(day)}` : '';
  const tob = to24h(hour, minute, period) ?? '';

  const errors: Record<string, string> = {};
  if (name.trim().length < 2) errors.name = 'Enter your full name.';
  if (!gender) errors.gender = 'Choose one.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob)) || dob > new Date().toISOString().slice(0, 10)) errors.dob = 'Enter a valid date of birth.';
  if (!tobUnknown && !tob) errors.tob = 'Enter the hour (1–12) and minute of birth, and choose AM or PM.';
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.email = 'That email does not look right.';
  if (pin.length !== 5) errors.pin = 'Choose a 5-character PIN.';
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
    setDraft({
      name: name.trim(), middleName: middleName.trim(), gender, dob, tob: tobUnknown ? '' : tob, tobUnknown, religion,
      language, email: email.trim(), phone: phone.trim(), pin,
    });
    router.push('/register/global');
  }

  return (
    <Screen footer={<Button title="Next · Birth Location" onPress={next} />}>
      <Steps at={1} of={4} />
      <Title>Personal details</Title>
      <Lead>Your date of birth sets your sun sign, which decides your council voting group.</Lead>

      <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" error={show('name')} />
      <Field label="Middle name (optional)" value={middleName} onChangeText={setMiddleName} autoComplete="name-middle" maxLength={60} />

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

      {!tobUnknown && (
        <>
          <View style={styles.row}>
            <Field label="Hour of birth" value={hour} onChangeText={(t) => setHour(digits(2)(t))} keyboardType="number-pad" placeholder="1–12" style={styles.small} />
            <Field label="Minute" value={minute} onChangeText={(t) => setMinute(digits(2)(t))} keyboardType="number-pad" placeholder="MM" style={styles.small} />
            <View style={styles.ampm}>
              {(['AM', 'PM'] as const).map((p) => (
                <Chip key={p} label={p} selected={period === p} onPress={() => setPeriod(p)} />
              ))}
            </View>
          </View>
          <ErrorText>{show('tob')}</ErrorText>
        </>
      )}
      <Pressable
        style={styles.check}
        onPress={() => setTobUnknown(!tobUnknown)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: tobUnknown }}
      >
        <Ionicons name={tobUnknown ? 'checkbox' : 'square-outline'} size={22} color={colors.gold} />
        <Text style={styles.checkText}>I don't remember my exact birth time</Text>
      </Pressable>

      <SelectField label="Mother tongue" value={language} options={LANGUAGE_OPTIONS} onChange={setLanguage} placeholder="Choose your mother tongue" searchable />

      <SelectField
        label="🕉️ Spiritual path (optional — kept private)"
        value={religion}
        options={RELIGION_OPTIONS}
        onChange={(v) => setReligion(v as Religion)}
        placeholder="Not answered"
        clearLabel="Not answered"
      />

      <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={show('email')} />

      <Label>Choose a 5-character PIN</Label>
      <Text style={type.small}>{PIN_HINT}</Text>
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
  ampm: { flexDirection: 'row', alignSelf: 'flex-end', marginBottom: space.md },
  check: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  checkText: { color: colors.text, fontFamily: fonts.body, flex: 1 },
  sign: { color: colors.gold, fontFamily: fonts.medium, marginBottom: space.lg },
});
