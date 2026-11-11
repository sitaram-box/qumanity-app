/** Step 1 · Personal details: name, gender, date & time of birth (or "don't remember"), mother tongue, optional private
 * Spiritual path, optional contact, 5-character PIN (twice). */

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
import { RELIGIONS, RELIGION_HINT, type Religion } from '@/components/registration.logic';

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
  const [hour, setHour] = useState(draft.tob.slice(0, 2));
  const [minute, setMinute] = useState(draft.tob.slice(3, 5));
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
  const tob = hour && minute ? `${pad(hour)}:${pad(minute)}` : '';

  const errors: Record<string, string> = {};
  if (name.trim().length < 2) errors.name = 'Enter your full name.';
  if (!gender) errors.gender = 'Choose one.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || Number.isNaN(Date.parse(dob)) || dob > new Date().toISOString().slice(0, 10)) errors.dob = 'Enter a valid date of birth.';
  if (!tobUnknown && !/^([01]\d|2[0-3]):[0-5]\d$/.test(tob)) errors.tob = 'Enter time of birth as HH:MM (24-hour).';
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
            <Field label="Hour of birth" value={hour} onChangeText={(t) => setHour(digits(2)(t))} keyboardType="number-pad" placeholder="HH" style={styles.small} />
            <Field label="Minute" value={minute} onChangeText={(t) => setMinute(digits(2)(t))} keyboardType="number-pad" placeholder="MM" style={styles.small} />
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

      <Label>🕉️ Spiritual path (optional — kept private)</Label>
      <View style={styles.wrap}>
        {RELIGIONS.map((r) => (
          <Chip key={r.value} label={r.label} selected={religion === r.value} onPress={() => setReligion(religion === r.value ? '' : r.value)} />
        ))}
      </View>
      <Text style={[type.small, { marginBottom: space.md }]}>{RELIGION_HINT}</Text>

      <Field label="Phone (optional, for PIN recovery)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Field label="Email (optional, for PIN recovery)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" error={show('email')} />

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
  check: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.lg },
  checkText: { color: colors.text, fontFamily: fonts.body, flex: 1 },
  sign: { color: colors.gold, fontFamily: fonts.medium, marginBottom: space.lg },
  group: { color: colors.faint, fontFamily: fonts.medium, fontSize: 12, marginBottom: space.sm, textTransform: 'uppercase', letterSpacing: 1 },
});
