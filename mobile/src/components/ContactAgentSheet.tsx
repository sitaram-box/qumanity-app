/**
 * "Contact Agent" (2026-11-25, mobile redesign Step 3): opens a Case against the member's own
 * present Village -- mirrors the website's Village-page modal (POST /api/cases/create). Shown
 * from LevelPage.tsx only at `level === 'village'`, same reasoning the website's own button has
 * for living on the Village page specifically: Cases are village-scoped
 * (case_core.qumanity_cases.location_level defaults to 'village', and the server itself derives
 * the village from the caller's present_location_json, never from anything this sheet sends).
 *
 * On success, navigates straight into the new Case's chat (the same /chat/[kind]/[id] screen
 * every other kind already uses, now with `kind: 'case'` support) rather than leaving the member
 * on this sheet -- so opening a Case and then talking about it is one continuous action, not two.
 */

import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Q from '@/api/qumanity';
import { Button, Chip, ErrorText, Field } from '@/components/ui';
import { colors, fonts, space } from '@/theme';

const CASE_TYPES: { key: Q.CaseType; label: string }[] = [
  { key: 'commerce', label: 'Commerce' },
  { key: 'service_request', label: 'Service Request' },
];

export function ContactAgentSheet({ onClose }: { onClose: () => void }) {
  const [caseType, setCaseType] = useState<Q.CaseType>('service_request');
  const [subject, setSubject] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!subject.trim()) {
      setError('Describe what you need help with.');
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const newCase = await Q.createCase(caseType, subject.trim());
      // Navigate first, then close this full-screen sheet: closing first (while its slide-away
      // animation runs) loses the navigation and leaves the member on the board -- same fix as
      // LocalAreas.tsx's Open chat.
      router.push({ pathname: '/chat/[kind]/[id]', params: { kind: 'case', id: String(newCase.id) } });
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Contact Agent</Text>
          <Text style={styles.sub}>Open a Case with your village's assigned Agent.</Text>
        </View>
        <Pressable onPress={onClose} accessibilityRole="button">
          <Text style={styles.close}>← Board</Text>
        </Pressable>
      </View>
      <View style={{ paddingHorizontal: space.lg }}>
        <Text style={styles.label}>What kind of Case is this?</Text>
        <View style={styles.chipRow}>
          {CASE_TYPES.map((t) => (
            <Chip key={t.key} label={t.label} selected={caseType === t.key} onPress={() => setCaseType(t.key)} />
          ))}
        </View>
        <Field
          label="Describe what you need"
          value={subject}
          onChangeText={setSubject}
          placeholder="e.g. I need to sell my wheat harvest, or I need help with a ration card issue."
          multiline
          style={{ height: 100 }}
        />
        <ErrorText>{error}</ErrorText>
        <Button title="Open Case" onPress={submit} busy={busy} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space.lg },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  sub: { color: colors.dim, fontFamily: fonts.body, fontSize: 13, marginTop: 2 },
  close: { color: colors.gold, fontFamily: fonts.medium },
  label: { color: colors.dim, fontFamily: fonts.body, fontSize: 13, marginBottom: space.sm },
  chipRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
});
