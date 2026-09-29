/**
 * Step 4 · Review, optional donation, create the account, then show the
 * 9-digit Private ID once ("I have saved my Private ID → Dashboard").
 * A member can also register someone else here (e.g. a person without a smartphone): with
 * "I'm registering someone else" on, their own Private ID + PIN make them the referrer, and
 * nobody is signed in afterwards — the new member's Private ID is shown to hand over.
 */

import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { toStruct } from '@/api/locations';
import { donationPreview, register, type RegisterResult } from '@/api/qumanity';
import { CodeInput } from '@/components/CodeInput';
import { Button, Chip, ErrorText, Field, Label, Lead, Screen, Steps, Title } from '@/components/ui';
import { rememberedId } from '@/lib/remembered';
import { useApp } from '@/state/app';
import { colors, fonts, radius, space } from '@/theme';

const AMOUNTS = [1, 2, 5, 10, 20, 50, 100, 200];
const GENDER = { male: 'Male', female: 'Female', both: 'Third gender', '': '—' } as const;
const RECIPIENT: Record<string, string> = {
  earth: 'Earth',
  continent: 'Continent',
  country: 'Country',
  zone: 'Zone',
  state: 'State',
  district: 'District',
  tehsil: 'Tehsil',
  village: 'Village',
  referrer: 'Referrer',
  new_user: 'New member (locked until their first council vote)',
};

export default function Review() {
  const { draft, setDraft, acceptToken, resetDraft } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<RegisterResult | null>(null);
  const [preview, setPreview] = useState<[string, number][] | null>(null);
  const [copied, setCopied] = useState(false);

  const amount = draft.donate ? draft.donationAmount : 0;
  const helperDigits = draft.helperId.replace(/\D/g, '');
  const helping = draft.helping;
  const hasReferrer = helping || draft.referralCode.trim().length > 0;
  const helperReady = !helping || (helperDigits.length === 9 && draft.helperPin.length === 5);

  // On a phone that remembers a member, registering someone else is the usual case: pre-fill it.
  useEffect(() => {
    if (draft.helperId) return;
    rememberedId().then((id) => id && setDraft({ helping: true, helperId: id }), () => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!amount) return setPreview(null);
    let live = true;
    donationPreview(amount, hasReferrer).then((p) => live && setPreview(p.rows), () => live && setPreview(null));
    return () => {
      live = false;
    };
  }, [amount, hasReferrer]);

  async function create() {
    setBusy(true);
    setError(undefined);
    try {
      const r = await register({
        name: draft.name,
        gender: draft.gender as 'male' | 'female' | 'both',
        dob: draft.dob,
        tob: draft.tob,
        pin: draft.pin,
        language: draft.language,
        email: draft.email || undefined,
        phone: draft.phone || undefined,
        birth_location: toStruct(draft.birth),
        present_location: toStruct(draft.present),
        donation_amount: amount || undefined,
        referral_code: !helping && hasReferrer ? draft.referralCode.trim() : undefined,
        referrer_pin: !helping && hasReferrer && amount ? draft.referrerPin : undefined,
        ...(helping ? { assisted: true, helper_private_id: helperDigits, helper_pin: draft.helperPin } : {}),
      });
      setResult(r);
    } catch (e) {
      setError((e as Error).message);
      if (helping) setDraft({ helperPin: '' });
    } finally {
      setBusy(false);
    }
  }

  if (result?.assisted) {
    const code = result.private_code;
    const again = (to: '/register' | '/welcome') => {
      resetDraft();
      router.replace(to);
    };
    return (
      <Screen
        footer={
          <View style={{ gap: space.sm }}>
            <Button title="Register another member" icon="person-add-outline" onPress={() => again('/register')} />
            <Button title="Done" variant="ghost" onPress={() => again('/welcome')} />
          </View>
        }
      >
        <Title>{draft.name.split(' ')[0]} is registered</Title>
        <Lead>Write this Private ID on paper and give it to them, with the PIN they chose. They sign in with both — Qumanity cannot send it to them again. You are recorded as their referrer.</Lead>
        <View style={styles.idCard}>
          <Text style={styles.id} selectable accessibilityLabel={`Private ID ${code.split('').join(' ')}`}>
            {code.slice(0, 3)} {code.slice(3, 6)} {code.slice(6)}
          </Text>
          <Button
            title={copied ? 'Copied' : 'Copy'}
            variant="ghost"
            onPress={async () => {
              await Clipboard.setStringAsync(code);
              setCopied(true);
            }}
          />
        </View>
        {result.donation_error && <Text style={styles.warn}>{result.donation_error}</Text>}
      </Screen>
    );
  }

  if (result) {
    const code = result.private_code;
    return (
      <Screen
        footer={
          <Button
            title="I have saved my Private ID → Dashboard"
            onPress={async () => {
              if (result.token) await acceptToken(result.token);
              resetDraft();
            }}
          />
        }
      >
        <Title>Your Private ID</Title>
        <Lead>Write it down and keep it secret. You sign in with it and your PIN. Qumanity cannot send it to you again.</Lead>
        <View style={styles.idCard}>
          <Text style={styles.id} selectable accessibilityLabel={`Private ID ${code.split('').join(' ')}`}>
            {code.slice(0, 3)} {code.slice(3, 6)} {code.slice(6)}
          </Text>
          <Button
            title={copied ? 'Copied' : 'Copy'}
            variant="ghost"
            onPress={async () => {
              await Clipboard.setStringAsync(code);
              setCopied(true);
            }}
          />
        </View>
        {result.donation_error && <Text style={styles.warn}>{result.donation_error}</Text>}
        {result.zodiac && (
          <Text style={styles.meta}>
            Sun {result.zodiac.sun_sign} ({result.zodiac.sun_element}) · Moon {result.zodiac.moon_sign} · Ascendant {result.zodiac.ascendant_sign}
          </Text>
        )}
      </Screen>
    );
  }

  const rows: [string, string][] = [
    ['Name', draft.name],
    ['Gender', GENDER[draft.gender]],
    ['Born', `${draft.dob} at ${draft.tob}`],
    ['Mother tongue', draft.language],
    ['Global account · born in', draft.birth.filter((p) => p.label !== null).map((p) => p.name).join(' › ')],
    ['Public account · living in', draft.present.filter((p) => p.label !== null).map((p) => p.name).join(' › ')],
  ];

  return (
    <Screen footer={<Button title={helping ? 'Create their account' : 'Create my account'} onPress={create} busy={busy} disabled={!helperReady} />}>
      <Steps at={4} of={4} />
      <Title>Review</Title>
      <View style={styles.card}>
        {rows.map(([k, v]) => (
          <View key={k} style={{ paddingVertical: 4 }}>
            <Text style={styles.k}>{k}</Text>
            <Text style={styles.v}>{v}</Text>
          </View>
        ))}
      </View>

      <View style={styles.toggle}>
        <View style={{ flex: 1 }}>
          <Text style={styles.v}>I'm registering someone else</Text>
          <Text style={styles.hint}>For a person without a smartphone. You become their referrer.</Text>
        </View>
        <Switch
          value={helping}
          onValueChange={(v) => setDraft({ helping: v, helperPin: '' })}
          trackColor={{ true: colors.gold, false: colors.line }}
          accessibilityLabel="I'm registering someone else"
        />
      </View>
      {helping && (
        <View style={styles.card}>
          <Field
            label="Your own Private ID"
            value={draft.helperId}
            onChangeText={(t) => setDraft({ helperId: t.replace(/[^\d ]/g, '').slice(0, 11) })}
            keyboardType="number-pad"
            placeholder="123 456 789"
          />
          <Label>Your PIN — confirms it's you</Label>
          <CodeInput length={5} secure value={draft.helperPin} onChange={(v) => setDraft({ helperPin: v })} autoFocus={false} accessibilityLabel="Your PIN" />
          <Text style={styles.hint}>Only checked by the Qumanity website, never stored on this phone.</Text>
        </View>
      )}

      <View style={styles.toggle}>
        <View style={{ flex: 1 }}>
          <Text style={styles.v}>Donate at registration (optional)</Text>
          <Text style={styles.hint}>Up to 200, paid in cash. It is shared between the location groups, the referrer, and the new member.</Text>
        </View>
        <Switch
          value={draft.donate}
          onValueChange={(v) => setDraft({ donate: v, donationAmount: v ? draft.donationAmount || 10 : 0 })}
          trackColor={{ true: colors.gold, false: colors.line }}
          accessibilityLabel="Donate at registration"
        />
      </View>

      {draft.donate && (
        <View style={styles.card}>
          <Label>Amount</Label>
          <View style={styles.wrap}>
            {AMOUNTS.map((a) => (
              <Chip key={a} label={String(a)} selected={draft.donationAmount === a} onPress={() => setDraft({ donationAmount: a })} />
            ))}
          </View>
          <TextInput
            value={String(draft.donationAmount || '')}
            onChangeText={(t) => setDraft({ donationAmount: Math.min(200, Number(t.replace(/\D/g, '') || 0)) })}
            keyboardType="number-pad"
            placeholder="Other amount (up to 200)"
            placeholderTextColor={colors.faint}
            style={styles.input}
            accessibilityLabel="Donation amount"
          />
          {!helping && (
            <Field label="Referral code (optional)" value={draft.referralCode} onChangeText={(t) => setDraft({ referralCode: t.toUpperCase() })} autoCapitalize="characters" placeholder="REF-…" />
          )}
          {!helping && hasReferrer && (
            <>
              <Label>Volunteer: type your own PIN to confirm you received the cash</Label>
              <CodeInput length={5} secure value={draft.referrerPin} onChange={(v) => setDraft({ referrerPin: v })} autoFocus={false} accessibilityLabel="Volunteer PIN" />
            </>
          )}
          {preview && (
            <View style={{ marginTop: space.md }}>
              <Label>Where it goes</Label>
              {preview.map(([who, value]) => (
                <View key={who} style={styles.split}>
                  <Text style={styles.splitWho}>{RECIPIENT[who] ?? who}</Text>
                  <Text style={styles.splitAmt}>{value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: space.lg, marginBottom: space.lg },
  k: { color: colors.dim, fontFamily: fonts.medium, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  v: { color: colors.text, fontFamily: fonts.body, fontSize: 16 },
  hint: { color: colors.dim, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.lg },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.sm },
  input: {
    height: 48,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ink,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontFamily: fonts.body,
    marginBottom: space.lg,
  },
  split: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  splitWho: { color: colors.dim, fontFamily: fonts.body },
  splitAmt: { color: colors.gold, fontFamily: fonts.bold },
  idCard: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: space.xl, alignItems: 'center', gap: space.lg, borderWidth: 1, borderColor: colors.gold },
  id: { color: colors.gold, fontFamily: fonts.displayBold, fontSize: 34, letterSpacing: 3 },
  warn: { color: colors.saffron, fontFamily: fonts.body, marginTop: space.lg },
  meta: { color: colors.dim, fontFamily: fonts.body, marginTop: space.lg, textAlign: 'center' },
});
