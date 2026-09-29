/** Private account: relationship status and work profile (2026-09-28). Self-service — no council
 * approval needed, since neither touches kundali/zodiac/location. */

import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { BackHeader, Button, Chip, ErrorText, Field, Label, Screen } from '@/components/ui';
import { colors, fonts, space } from '@/theme';

const RELATIONSHIP_OPTIONS: { value: Q.RelationshipStatus; label: string }[] = [
  { value: 'single', label: 'Single / Unmarried' },
  { value: 'married', label: 'Married' },
  { value: 'divorced_widowed', label: 'Divorced / Widowed' },
];
const WORK_OPTIONS: { value: Q.WorkProfile; label: string }[] = [
  { value: 'unemployed_student', label: 'Unemployed / Student' },
  { value: 'employed', label: 'Employed / Job' },
  { value: 'govt', label: 'Govt Leader / Officer / Employee' },
  { value: 'security', label: 'Security (Army / Police)' },
  { value: 'medical', label: 'Medical (Doctor / Nurse / Pharmacist)' },
  { value: 'other', label: 'OTH / NOTA' },
];

export default function PersonalDetails() {
  const [details, setDetails] = useState<Q.PersonalDetails | null>(null);
  const [status, setStatus] = useState<Q.RelationshipStatus | null>(null);
  const [hasChildren, setHasChildren] = useState(false);
  const [sons, setSons] = useState('0');
  const [daughters, setDaughters] = useState('0');
  const [work, setWork] = useState<Q.WorkProfile | null>(null);
  const [workOther, setWorkOther] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    Q.personalDetails().then((d) => {
      setDetails(d);
      setStatus(d.relationship_status);
      setHasChildren(!!d.has_children);
      setSons(String(d.sons_count));
      setDaughters(String(d.daughters_count));
      setWork(d.work_profile);
      setWorkOther(d.work_profile_other ?? '');
    }, (e) => setError((e as Error).message));
  }, []);

  async function save() {
    setBusy(true);
    setMsg(undefined);
    setError(undefined);
    try {
      await Q.savePersonalDetails({
        relationship_status: status,
        has_children: status === 'married' ? hasChildren : null,
        sons_count: status === 'married' && hasChildren ? parseInt(sons, 10) || 0 : 0,
        daughters_count: status === 'married' && hasChildren ? parseInt(daughters, 10) || 0 : 0,
        work_profile: work,
        work_profile_other: work === 'other' ? workOther.trim() : null,
      });
      setMsg('Saved.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!details) return <Screen><BackHeader title="Personal details" /><ErrorText>{error}</ErrorText></Screen>;

  return (
    <Screen footer={<Button title="Save" onPress={save} busy={busy} />}>
      <BackHeader title="Personal details" />

      <Label>Relationship status</Label>
      <View style={styles.chips}>
        {RELATIONSHIP_OPTIONS.map((o) => (
          <Chip key={o.value} label={o.label} selected={status === o.value} onPress={() => setStatus(status === o.value ? null : o.value)} />
        ))}
      </View>

      {status === 'married' && (
        <View style={styles.subcard}>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>Do you have children?</Text>
            <View style={styles.chips}>
              <Chip label="Yes" selected={hasChildren} onPress={() => setHasChildren(true)} />
              <Chip label="No" selected={!hasChildren} onPress={() => setHasChildren(false)} />
            </View>
          </View>
          {hasChildren && (
            <View style={styles.row}>
              <Field label="Number of sons" value={sons} onChangeText={setSons} keyboardType="number-pad" style={styles.countInput} />
              <Field label="Number of daughters" value={daughters} onChangeText={setDaughters} keyboardType="number-pad" style={styles.countInput} />
            </View>
          )}
        </View>
      )}

      <Label>Work profile</Label>
      <View style={styles.chips}>
        {WORK_OPTIONS.map((o) => (
          <Chip key={o.value} label={o.label} selected={work === o.value} onPress={() => setWork(work === o.value ? null : o.value)} />
        ))}
      </View>
      {work === 'other' && <Field label="Describe your work" value={workOther} onChangeText={setWorkOther} maxLength={120} />}

      {msg && <Text style={styles.ok}>{msg}</Text>}
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: space.lg },
  subcard: { backgroundColor: colors.panel, borderRadius: 12, padding: space.lg, marginBottom: space.lg },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start', marginBottom: space.sm },
  rowLabel: { color: colors.text, fontFamily: fonts.medium, fontSize: 14, marginRight: space.sm, alignSelf: 'center' },
  countInput: { flex: 1 },
  ok: { color: colors.earth, fontFamily: fonts.medium, marginTop: space.md },
});
