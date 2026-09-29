/** The 5 Q-Punch council seats of a group (same popup as the website board). */

import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { colors, fonts, radius, space } from '@/theme';
import { ElectionCard } from './ElectionCard';
import { Button, ErrorText } from './ui';

export function QPunchSheet({ level, visible, onClose }: { level: Q.BoardLevel; visible: boolean; onClose: () => void }) {
  const [data, setData] = useState<Q.QPunch | null>(null);
  const [error, setError] = useState<string>();
  const [skill, setSkill] = useState('');
  const [busy, setBusy] = useState(false);
  const [ref, setRef] = useState<Awaited<ReturnType<typeof Q.referrerMe>> | null>(null);
  const [note, setNote] = useState('');

  const load = () => {
    Q.referrerMe().then(setRef, () => undefined);
    return Q.qpunch(level).then(setData, (e) => setError((e as Error).message));
  };

  useEffect(() => {
    if (!visible) return;
    setData(null);
    setError(undefined);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, level]);

  async function register() {
    setBusy(true);
    try {
      await Q.volunteer(skill.trim());
      setSkill('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function applyReferrer() {
    setBusy(true);
    try {
      await Q.referrerApply(note.trim());
      setNote('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title}>Q-Punch council</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close">
              <Text style={styles.close}>Close</Text>
            </Pressable>
          </View>
          {!data ? (
            error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} />
          ) : (
            <ScrollView>
              <Text style={styles.sub}>
                {data.group} · {data.label}
              </Text>
              <Text style={styles.meta}>
                {data.election_open
                  ? 'Elections are open.'
                  : `Elections start at ${data.election_min.toLocaleString()} residents · now ${data.residents.toLocaleString()}`}
              </Text>
              {data.cycle?.lead && <Text style={styles.meta}>This month: {data.cycle.lead} cycle</Text>}
              {data.election && <ElectionCard election={data.election} guide={data.guide} onChanged={load} />}
              {data.seats.map((s) => (
                <View key={s.seat} style={[styles.seat, s.filled && { borderColor: colors.gold }]}>
                  <View style={[styles.seatNo, s.filled && { backgroundColor: colors.gold }]}>
                    <Text style={[styles.seatNoText, s.filled && { color: colors.onAccent }]}>{s.seat}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.seatTitle}>
                      {s.title}
                      {!s.filled && <Text style={styles.open}> · open</Text>}
                    </Text>
                    <Text style={styles.seatText}>{s.text}</Text>
                  </View>
                </View>
              ))}
              {data.can_volunteer && !data.is_volunteer && (
                <View style={{ gap: space.sm, marginTop: space.md }}>
                  <Text style={styles.seatTitle}>Register as a volunteer (seat 5)</Text>
                  <TextInput
                    value={skill}
                    onChangeText={setSkill}
                    placeholder="What can you offer? e.g. electrician, tutor"
                    placeholderTextColor={colors.faint}
                    style={styles.input}
                    accessibilityLabel="Volunteer skill"
                  />
                  <Button title="Register" variant="ghost" onPress={register} busy={busy} disabled={!skill.trim()} />
                </View>
              )}
              {data.is_volunteer && <Text style={styles.meta}>You are registered as a volunteer.</Text>}
              {ref?.code ? (
                <Text style={styles.meta}>✓ Referral code {ref.code.code} · used {ref.code.uses} {ref.code.uses === 1 ? 'time' : 'times'}</Text>
              ) : ref?.pending ? (
                <Text style={styles.meta}>Referrer application pending council review</Text>
              ) : ref ? (
                <View style={{ gap: space.sm, marginTop: space.md }}>
                  <Text style={styles.seatTitle}>Become a referrer</Text>
                  <TextInput value={note} onChangeText={setNote} placeholder="Why do you want to be a referrer?" placeholderTextColor={colors.faint} style={styles.input} maxLength={300} accessibilityLabel="Why do you want to be a referrer" />
                  <Button title="Apply to be a referrer" variant="ghost" onPress={applyReferrer} busy={busy} disabled={!note.trim()} />
                </View>
              ) : null}
              <ErrorText>{error}</ErrorText>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.ink, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: space.lg, paddingBottom: space.xl, paddingTop: space.sm, maxHeight: '85%', borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  handle: { alignSelf: 'center', width: 38, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: space.md },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.md },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 18 },
  close: { color: colors.gold, fontFamily: fonts.medium },
  sub: { color: colors.text, fontFamily: fonts.bold, fontSize: 14.5 },
  meta: { color: colors.dim, fontFamily: fonts.body, fontSize: 12.5, marginTop: 2, marginBottom: space.xs },
  seat: { flexDirection: 'row', gap: space.sm, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, borderRadius: radius.md, padding: 10, marginTop: space.sm },
  seatNo: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.panelRaised, alignItems: 'center', justifyContent: 'center' },
  seatNoText: { color: colors.dim, fontFamily: fonts.bold, fontSize: 12 },
  seatTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 13.5 },
  open: { color: colors.faint, fontFamily: fonts.body },
  seatText: { color: colors.dim, fontFamily: fonts.body, fontSize: 12, marginTop: 2, lineHeight: 17 },
  input: {
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: space.lg,
    color: colors.text,
    fontFamily: fonts.body,
  },
});
