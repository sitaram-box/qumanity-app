/**
 * The village's monthly sign election inside Q-Punch (same data as the website popup):
 * the 4-week timeline with this week lit, what THIS member should do, the candidates, and — in
 * week 4 — the new leaders with their 1-year term. Week 1: stand; weeks 2-3: vote; week 4: results.
 */

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { useApp } from '@/state/app';
import { colors, fonts, radius, space, tint } from '@/theme';
import { Button, ErrorText } from './ui';

const ELEMENT_COLOR: Record<string, string> = { Fire: colors.fire, Earth: colors.earth, Air: colors.air, Water: colors.water };
const short = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

export function ElectionCard({ election, guide, onChanged }: { election: Q.ElectionSummary; guide: Q.ElectionGuide | null | undefined; onChanged: () => void }) {
  const { me } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [form, setForm] = useState({ reason: '', why_vote: '', changes: '' });
  const formDone = form.reason.trim() && form.why_vote.trim() && form.changes.trim();
  const accent = ELEMENT_COLOR[election.element] ?? colors.gold;
  const myGender = me?.gender === 'male' || me?.gender === 'female' ? me.gender : null;

  const act = (key: string, fn: () => Promise<unknown>) => async () => {
    setBusy(key);
    setError(undefined);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.card, { borderColor: accent }]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: tint(accent) }]}>
          <Ionicons name="checkbox-outline" size={13} color={accent} />
          <Text style={[styles.badgeText, { color: accent }]}>{election.sign.toUpperCase()} ELECTION</Text>
        </View>
        <Text style={styles.week}>Week {election.week} of 4</Text>
      </View>

      <View style={styles.timeline}>
        {election.weeks.map((w) => {
          const now = w.week === election.week;
          const done = w.week < election.week;
          return (
            <View key={w.week} style={[styles.step, now && { borderColor: accent, backgroundColor: tint(accent) }]}>
              <Text style={[styles.stepNo, (now || done) && { color: accent }]}>{done ? '✓' : w.week}</Text>
              <Text style={[styles.stepTitle, now && { color: colors.text }]} numberOfLines={2}>{w.title}</Text>
              <Text style={styles.stepDate}>{short(w.start)}–{short(w.end)}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.body}>{election.weeks.find((w) => w.week === election.week)?.text}</Text>

      {guide && (
        <View style={[styles.guide, guide.action && { borderColor: colors.gold }]}>
          <Ionicons name={guide.action ? 'megaphone' : 'information-circle'} size={16} color={guide.action ? colors.gold : colors.dim} />
          <Text style={styles.guideText}>{guide.text}</Text>
        </View>
      )}

      {guide?.can_stand && (
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {(
            [
              ['reason', 'Why are you standing?'],
              ['why_vote', 'Why should members vote for you?'],
              ['changes', 'What will you change?'],
            ] as const
          ).map(([key, label]) => (
            <TextInput
              key={key}
              value={form[key]}
              onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
              placeholder={label}
              placeholderTextColor={colors.faint}
              style={styles.input}
              multiline
              maxLength={300}
              accessibilityLabel={label}
            />
          ))}
          <Button
            title="Stand as a candidate"
            icon="hand-right"
            onPress={act('stand', () => Q.electionNominate({ reason: form.reason.trim(), why_vote: form.why_vote.trim(), changes: form.changes.trim() }))}
            busy={busy === 'stand'}
            disabled={!formDone}
          />
        </View>
      )}

      {election.winners && (
        <View style={styles.winners}>
          <Text style={styles.section}>New {election.sign} leaders</Text>
          {(['male', 'female'] as const).map((g) =>
            election.winners![g] ? (
              <Text key={g} style={styles.winner}>
                🏆 {election.winners![g]} <Text style={styles.dimSmall}>· {g === 'male' ? 'Male' : 'Female'} Leader · {election.winners![`${g}_votes`]} votes</Text>
              </Text>
            ) : null,
          )}
          <Text style={styles.dimSmall}>Term of work: {short(election.winners.term_start)} {election.winners.term_start.slice(0, 4)} – {short(election.winners.term_end)} {election.winners.term_end.slice(0, 4)} (1 year)</Text>
        </View>
      )}

      {(['male', 'female'] as const).map((g) => {
        const list = election.candidates[g];
        const canVoteHere = guide?.can_vote && myGender === g && !guide.voted_genders.includes(g);
        return (
          <View key={g}>
            <Text style={styles.section}>
              {g === 'male' ? 'Male' : 'Female'} candidates {list.length ? `(${list.length})` : ''}
            </Text>
            {list.length === 0 && <Text style={styles.dimSmall}>{election.status === 'nomination' ? 'Candidates are coming forward this week.' : 'No candidates.'}</Text>}
            {list.map((c) => {
              const won = election.winners?.[g] === c.name;
              return (
                <View key={c.user_id} style={[styles.cand, won && { borderColor: colors.gold }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.candName}>
                      {c.name}
                      {c.votes !== null && <Text style={styles.dimSmall}> · {c.votes} votes</Text>}
                    </Text>
                    {!!c.reason && <Text style={styles.candText}>“{c.reason}”</Text>}
                    {!!c.changes && <Text style={styles.dimSmall}>Plan: {c.changes}</Text>}
                  </View>
                  {canVoteHere && (
                    <Button title="Vote" size="sm" onPress={act(`v${c.user_id}`, () => Q.electionVote(c.user_id, g))} busy={busy === `v${c.user_id}`} />
                  )}
                </View>
              );
            })}
          </View>
        );
      })}

      <Text style={[styles.dimSmall, { marginTop: space.sm }]}>
        {election.turnout} of {election.eligible_voters} {election.sign} members have voted.
      </Text>
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.lg, backgroundColor: colors.panel, padding: space.md, marginTop: space.sm, marginBottom: space.sm },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 22, borderRadius: 11 },
  badgeText: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 0.5 },
  week: { color: colors.dim, fontFamily: fonts.medium, fontSize: 12 },
  timeline: { flexDirection: 'row', gap: 5, marginTop: space.sm },
  step: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 6, gap: 2 },
  stepNo: { color: colors.faint, fontFamily: fonts.bold, fontSize: 13 },
  stepTitle: { color: colors.dim, fontFamily: fonts.medium, fontSize: 10.5, lineHeight: 13 },
  stepDate: { color: colors.faint, fontFamily: fonts.body, fontSize: 9.5 },
  body: { color: colors.dim, fontFamily: fonts.body, fontSize: 12, lineHeight: 17, marginTop: space.sm },
  guide: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 10, marginTop: space.sm, backgroundColor: colors.panelRaised },
  guideText: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 18 },
  section: { color: colors.text, fontFamily: fonts.bold, fontSize: 13, marginTop: space.md, marginBottom: 4 },
  cand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 10, marginTop: 6 },
  candName: { color: colors.text, fontFamily: fonts.bold, fontSize: 13.5 },
  candText: { color: colors.dim, fontFamily: fonts.body, fontSize: 12, marginTop: 2, lineHeight: 17 },
  dimSmall: { color: colors.faint, fontFamily: fonts.body, fontSize: 11.5 },
  winners: { borderWidth: 1, borderColor: colors.gold, borderRadius: radius.md, padding: 10, marginTop: space.sm, backgroundColor: colors.goldSoft },
  winner: { color: colors.text, fontFamily: fonts.bold, fontSize: 14, marginTop: 4 },
  input: { minHeight: 48, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ink, padding: space.sm, color: colors.text, fontFamily: fonts.body, textAlignVertical: 'top' },
});
