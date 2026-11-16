/**
 * Q-Punch council election for Tehsil and up (website election_core cascade, 2026-11-16), inside
 * the Q-Punch sheet. The village keeps its own monthly sun-sign election (ElectionCard); this is
 * the 8-seat element council one level up and beyond — same data and rules as the website's
 * board.js (cascadeElectionBlock):
 *
 *   - The council: 1 Male + 1 Female per element. The elements take turns leading, one per
 *     quarter; the leading pair is highlighted, with who holds Head.
 *   - Head approval: the Upper House (everyone living here) votes Yes/No on the leading Male
 *     becoming official Head (51%). Shown only to someone who can still vote on it.
 *   - Nomination week: a Lower House member can stand as a candidate.
 *   - Voting: a Lower House member picks 1 Male and 1 Female for each element and sends them —
 *     one vote per seat (the website records each separately; seats already voted are locked).
 *
 * The website decides every eligibility question; its messages are shown as-is.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { colors, fonts, radius, space, tint } from '@/theme';
import {
  ELEMENTS,
  ELEMENT_EMOJI,
  GENDERS,
  alreadyVoted,
  approvalCandidateName,
  headLine,
  rotationLabel,
  seatKey,
  votesToSend,
  type SeatKey,
} from './qpunchCascade.logic';
import { Button, ErrorText, Field } from './ui';

const ELEMENT_COLOR: Record<Q.Element, string> = { Fire: colors.fire, Earth: colors.earth, Air: colors.air, Water: colors.water };

function confirmThen(title: string, text: string, ok: string, run: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`${title}\n${text}`)) run();
    return;
  }
  Alert.alert(title, text, [
    { text: 'Cancel', style: 'cancel' },
    { text: ok, onPress: run },
  ]);
}

export function CascadeElection({ level, locationId }: { level: Q.BoardLevel; locationId: string }) {
  const [status, setStatus] = useState<Q.CascadeStatus | null>(null);
  const [candidates, setCandidates] = useState<Q.CascadeCandidates | null>(null);
  const [chosen, setChosen] = useState<Partial<Record<SeatKey, { user_id: number; name: string }>>>({});
  const [nom, setNom] = useState({ reason: '', why_vote: '', changes: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [note, setNote] = useState<string>();

  const load = useCallback(async () => {
    try {
      // One after the other, not in parallel: the first read of a new location creates its election
      // cycle on the website, and two simultaneous first reads both try to create it (one fails
      // with a 500). Status first, so the cycle exists before candidates are read.
      const s = await Q.cascadeStatus(level, locationId);
      const c = await Q.cascadeCandidates(level, locationId);
      setStatus(s);
      setCandidates(c);
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [level, locationId]);

  useEffect(() => {
    setStatus(null);
    setChosen({});
    load();
  }, [load]);

  if (!status) return error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} style={{ marginVertical: space.md }} />;

  const { cycle, eligibility: elig, council } = status;
  const toSend = votesToSend(chosen, elig.voted);

  async function run(fn: () => Promise<unknown>, done: string) {
    setBusy(true);
    setError(undefined);
    setNote(undefined);
    try {
      await fn();
      setNote(done);
      await load();
    } catch (e) {
      setError((e as Error).message);
      await load();
    } finally {
      setBusy(false);
    }
  }

  function approve(yes: boolean) {
    if (!council) return;
    const name = approvalCandidateName(council);
    confirmThen(
      yes ? `Approve ${name} as official Head?` : `Reject ${name} as official Head?`,
      'You can vote only once on this quarter’s Head approval.',
      yes ? 'Approve' : 'Reject',
      () => run(() => Q.headApprovalVote(council.id, yes), 'Your Head approval vote is recorded.'),
    );
  }

  function sendVotes() {
    const list = toSend.map((v) => `${v.element} ${v.gender === 'male' ? 'Male' : 'Female'}: ${v.name}`).join('\n');
    confirmThen(`Send ${toSend.length} ${toSend.length === 1 ? 'vote' : 'votes'}?`, `${list}\n\nYou can vote only once for each seat.`, 'Send', () =>
      run(async () => {
        // One seat at a time, in order; stops at the first refusal so the website's reason is shown.
        for (const v of toSend) await Q.cascadeVote(level, locationId, v.element, v.gender, v.user_id);
        setChosen({});
      }, 'Your votes are recorded.'),
    );
  }

  const lead = council?.active_element ?? null;
  const leadPair = lead && council ? council.members[lead] : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Council election</Text>
      <Text style={styles.meta}>
        Lower House: {status.lower_house_size.toLocaleString()} serving {status.lower_house_size === 1 ? 'member' : 'members'}
        {cycle.term_years ? ` · ${cycle.term_years}-year term` : ''} · {cycle.status}
      </Text>

      {council ? (
        <>
          {lead && (
            <View style={[styles.card, { borderColor: ELEMENT_COLOR[lead], backgroundColor: tint(ELEMENT_COLOR[lead], '14') }]}>
              <Text style={styles.cardTitle}>
                {ELEMENT_EMOJI[lead]} {lead} leads the council this quarter
              </Text>
              <Text style={styles.body}>
                {leadPair?.male?.name ?? '—'} (Male) and {leadPair?.female?.name ?? '—'} (Female)
              </Text>
              {headLine(council) && <Text style={styles.head}>{headLine(council)}</Text>}
            </View>
          )}

          <Text style={styles.sub}>Full council</Text>
          {ELEMENTS.map((e) => {
            const m = council.members[e];
            const on = e === lead;
            return (
              <View key={e} style={[styles.row, on && { borderColor: ELEMENT_COLOR[e] }]}>
                <Text style={[styles.rowEl, { color: ELEMENT_COLOR[e] }]}>
                  {ELEMENT_EMOJI[e]} {e}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowNames} numberOfLines={2}>
                    {m?.male?.name ?? '—'} & {m?.female?.name ?? '—'}
                  </Text>
                  <Text style={[styles.meta, on && { color: ELEMENT_COLOR[e] }]}>{rotationLabel(e, lead)}</Text>
                </View>
              </View>
            );
          })}

          {council.approval && council.is_upper_house && !council.approval.already_voted && (
            <View style={[styles.card, { borderColor: colors.gold }]}>
              <Text style={styles.cardTitle}>Approve {approvalCandidateName(council)} as official Head?</Text>
              <Text style={styles.meta}>Upper House vote · open until {council.approval.approval_end} · 51% needed</Text>
              <View style={styles.actions}>
                <Button title="Yes" icon="checkmark" size="sm" onPress={() => approve(true)} busy={busy} style={{ flex: 1 }} />
                <Button title="No" icon="close" size="sm" variant="ghost" onPress={() => approve(false)} disabled={busy} style={{ flex: 1 }} />
              </View>
            </View>
          )}
          {council.approval?.already_voted && <Text style={styles.ok}>✓ You've voted on this quarter's Head approval.</Text>}
        </>
      ) : (
        <Text style={styles.body}>No council elected yet for this {level} — the first election is underway.</Text>
      )}

      {cycle.status === 'nomination' &&
        (elig.can_nominate ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Stand as a candidate</Text>
            <Text style={styles.meta}>Nominations close {cycle.nomination_end}. You stand for the seat of your own sun sign’s element.</Text>
            <Field label="Why are you standing?" value={nom.reason} onChangeText={(t) => setNom({ ...nom, reason: t })} maxLength={300} />
            <Field label="Why should the Lower House vote for you?" value={nom.why_vote} onChangeText={(t) => setNom({ ...nom, why_vote: t })} maxLength={300} />
            <Field label="What will you change?" value={nom.changes} onChangeText={(t) => setNom({ ...nom, changes: t })} maxLength={300} />
            <Button
              title="Stand as a candidate"
              icon="ribbon-outline"
              size="sm"
              busy={busy}
              disabled={!nom.reason.trim() || !nom.why_vote.trim() || !nom.changes.trim()}
              onPress={() => run(() => Q.cascadeNominate(level, locationId, nom), 'Your candidacy is submitted.')}
            />
          </View>
        ) : (
          <Text style={styles.body}>
            {elig.already_nominated ? '✓ You have submitted your candidacy for this cycle.' : elig.nominate_reason || 'Nomination is open to this location’s Lower House only.'}
          </Text>
        ))}

      {cycle.status === 'voting' &&
        (elig.can_vote && candidates ? (
          <>
            <Text style={styles.sub}>Your ballot · 1 Male and 1 Female for each element</Text>
            {ELEMENTS.map((e) => (
              <View key={e} style={[styles.card, { borderColor: tint(ELEMENT_COLOR[e], '66') }]}>
                <Text style={[styles.cardTitle, { color: ELEMENT_COLOR[e] }]}>
                  {ELEMENT_EMOJI[e]} {e} seats
                </Text>
                {GENDERS.map((g) => {
                  const list = candidates[e]?.[g] ?? [];
                  const done = alreadyVoted(elig.voted, e, g);
                  const pick = chosen[seatKey(e, g)];
                  return (
                    <View key={g} style={{ gap: 6 }}>
                      <Text style={styles.gender}>
                        {g === 'male' ? 'Male' : 'Female'}
                        {done ? ' · ✓ voted' : ''}
                      </Text>
                      {list.length === 0 && <Text style={styles.meta}>No candidates.</Text>}
                      {!done &&
                        list.map((c) => {
                          const on = pick?.user_id === c.user_id;
                          return (
                            <Pressable
                              key={c.user_id}
                              onPress={() => setChosen((x) => ({ ...x, [seatKey(e, g)]: on ? undefined : { user_id: c.user_id, name: c.name } }))}
                              style={[styles.cand, on && { borderColor: ELEMENT_COLOR[e], backgroundColor: tint(ELEMENT_COLOR[e], '18') }]}
                              accessibilityRole="radio"
                              accessibilityState={{ selected: on }}
                              accessibilityLabel={`${c.name}, ${e} ${g}`}
                            >
                              <View style={[styles.radio, on && { borderColor: ELEMENT_COLOR[e], backgroundColor: ELEMENT_COLOR[e] }]} />
                              <View style={{ flex: 1 }}>
                                <Text style={styles.candName}>{c.name}</Text>
                                {(c.form_reason || c.manifest) && <Text style={styles.meta}>“{c.form_reason || c.manifest}”</Text>}
                                {c.form_changes && <Text style={styles.meta}>Plan: {c.form_changes}</Text>}
                              </View>
                            </Pressable>
                          );
                        })}
                    </View>
                  );
                })}
              </View>
            ))}
            <Button
              title={toSend.length ? `Send ${toSend.length} ${toSend.length === 1 ? 'vote' : 'votes'}` : 'Choose your candidates'}
              icon="checkmark-done"
              onPress={sendVotes}
              disabled={!toSend.length}
              busy={busy}
            />
          </>
        ) : (
          <Text style={styles.body}>{elig.vote_reason || 'Voting is open to this location’s Lower House only.'}</Text>
        ))}

      {note && <Text style={styles.ok}>{note}</Text>}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm, marginTop: space.md },
  heading: { color: colors.text, fontFamily: fonts.bold, fontSize: 16 },
  sub: { color: colors.dim, fontFamily: fonts.bold, fontSize: 13, marginTop: space.sm },
  meta: { color: colors.dim, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 17 },
  body: { color: colors.text, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19 },
  head: { color: colors.gold, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  ok: { color: colors.earth, fontFamily: fonts.medium, fontSize: 13 },
  card: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, borderRadius: radius.md, padding: space.md, gap: 6 },
  cardTitle: { color: colors.text, fontFamily: fonts.bold, fontSize: 14.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 10 },
  rowEl: { width: 78, fontFamily: fonts.bold, fontSize: 13 },
  rowNames: { color: colors.text, fontFamily: fonts.medium, fontSize: 13.5 },
  gender: { color: colors.dim, fontFamily: fonts.bold, fontSize: 12, marginTop: 4 },
  cand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 10 },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: colors.faint },
  candName: { color: colors.text, fontFamily: fonts.bold, fontSize: 13.5 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: 4 },
});
