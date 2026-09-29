/**
 * Collective Board for one level (same data and rules as the website board):
 * opens on Live voting; the ❄ Frozen button (bottom-right) switches to frozen
 * and elevated posts with scores, dates and comments. The message box stays at
 * the bottom: free text in the Village, paid text on Tehsil → Zone.
 */

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { colors, fonts, radius, space, tint } from '@/theme';
import { Avatar, ErrorText } from './ui';

const MAX_POST = 1000;

export function BoardView({ level, currency }: { level: Q.BoardLevel; currency: string }) {
  const [data, setData] = useState<Q.Board | null>(null);
  const [error, setError] = useState<string>();
  const [frozen, setFrozen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(undefined);
      setData(await Q.board(level));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [level]);

  useEffect(() => {
    setData(null);
    setFrozen(false);
    load();
  }, [load]);

  if (!data) {
    return error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} style={{ marginTop: space.xl }} />;
  }

  const posts = data.posts
    .filter((p) => (frozen ? p.status === 'frozen' || p.status === 'elevated' : p.status === 'active'))
    .sort((a, b) => (frozen ? b.score - a.score : 0));
  const canWrite = !frozen && (data.can_post || data.can_pay_post);

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.ruleRow}>
        <View style={[styles.liveDot, { backgroundColor: frozen ? colors.water : colors.earth }]} />
        <Text style={styles.rule} numberOfLines={1}>
          {frozen
            ? 'Frozen & elevated · best score first'
            : `Live voting · ${data.window_days} days · lifts at +${data.threshold.toLocaleString()}${data.next ? ` → ${data.next}` : ''}`}
        </Text>
      </View>
      <FlatList
        data={posts}
        keyExtractor={(p) => String(p.id)}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.gold}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
        contentContainerStyle={{ paddingBottom: 56 }}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name={frozen ? 'snow-outline' : 'chatbubbles-outline'} size={28} color={colors.faint} />
            <Text style={styles.empty}>{frozen ? 'No frozen posts yet.' : data.can_post ? 'No posts yet — write the first one below.' : 'No posts open for voting.'}</Text>
          </View>
        }
        renderItem={({ item }) => <PostCard post={item} onChanged={load} />}
      />
      <ErrorText>{error}</ErrorText>
      {canWrite && (
        <Composer
          level={level}
          paid={!data.can_post}
          price={data.post_price}
          priceQoins={data.post_price_qoins}
          currency={data.currency_symbol ?? currency}
          onPosted={load}
        />
      )}
      <Pressable
        onPress={() => setFrozen((f) => !f)}
        style={[styles.fab, { bottom: canWrite ? 78 : 10 }, frozen && { backgroundColor: colors.water, borderColor: colors.water }]}
        accessibilityRole="button"
        accessibilityLabel={frozen ? 'Back to live voting' : 'Show frozen posts'}
      >
        <Text style={[styles.fabText, frozen && { color: colors.onAccent }]}>{frozen ? '← Live' : '❄ Frozen'}</Text>
      </Pressable>
    </View>
  );
}

function PostCard({ post, onChanged }: { post: Q.BoardPost; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();

  async function vote(v: -1 | 0 | 1) {
    setBusy(true);
    setError(undefined);
    try {
      await Q.vote(post.id, v);
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function sendComment() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await Q.comment(post.id, text.trim());
      setText('');
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ends = new Date(post.voting_end);
  const scoreColor = post.score > 0 ? colors.earth : post.score < 0 ? colors.danger : colors.dim;
  const author = post.mine ? 'You' : post.author;
  return (
    <View style={styles.post}>
      <View style={styles.postHead}>
        <Avatar name={post.author} size={30} color={post.mine ? colors.gold : colors.saffron} />
        <View style={{ flex: 1 }}>
          <Text style={styles.author} numberOfLines={1}>
            {author}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {post.status === 'active'
              ? `Voting ends ${ends.toLocaleDateString([], { day: 'numeric', month: 'short' })}, ${ends.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
              : post.status === 'elevated'
                ? `↑ Elevated to ${post.elevated_to ?? 'next level'}`
                : `❄ Frozen ${ends.toLocaleDateString([], { day: 'numeric', month: 'short' })}`}
          </Text>
        </View>
        <View style={[styles.scoreBadge, { backgroundColor: tint(scoreColor) }]}>
          <Text style={[styles.score, { color: scoreColor }]}>{post.score > 0 ? `+${post.score}` : post.score}</Text>
        </View>
      </View>
      {post.origin && (
        <Text style={styles.origin}>
          ↑ From {post.origin.level} · score {post.origin.score}
        </Text>
      )}
      <Text style={styles.content}>{post.content}</Text>

      {post.can_vote && (
        <View style={styles.votes}>
          {([1, 0, -1] as const).map((v) => {
            const on = post.my_vote === v;
            return (
              <Pressable
                key={v}
                disabled={busy}
                onPress={() => vote(v)}
                style={[styles.voteBtn, on && styles.voteOn]}
                accessibilityRole="button"
                accessibilityLabel={`Vote ${v > 0 ? 'plus one' : v < 0 ? 'minus one' : 'zero'}`}
                accessibilityState={{ selected: on }}
              >
                <Text style={[styles.voteText, on && { color: colors.onAccent }]}>{v > 0 ? '+1' : v < 0 ? '−1' : '0'}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {post.can_comment && (
        <View style={styles.comments}>
          {post.comments.map((c, i) => (
            <Text key={i} style={styles.comment}>
              <Text style={{ fontFamily: fonts.bold, color: colors.text }}>{c.who} </Text>
              {c.text}
            </Text>
          ))}
          <View style={styles.commentRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Add a comment…"
              placeholderTextColor={colors.faint}
              style={styles.commentInput}
              maxLength={2000}
              accessibilityLabel="Comment"
            />
            <Pressable onPress={sendComment} disabled={busy || !text.trim()} accessibilityRole="button" accessibilityLabel="Send comment" hitSlop={8}>
              <Ionicons name="send" size={18} color={text.trim() ? colors.gold : colors.faint} />
            </Pressable>
          </View>
        </View>
      )}
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

function Composer({
  level,
  paid,
  price,
  priceQoins,
  currency,
  onPosted,
}: {
  level: Q.BoardLevel;
  paid: boolean;
  price: number | null;
  priceQoins: number[] | null;
  currency: string;
  onPosted: () => void;
}) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  // "<currency symbol><amount> | <n> Qoin(s)" -- currency value, a "|" separator, then the real
  // number of Qoins that make it up (e.g. ₹1000 = two 500-value Qoins). No sentence.
  const n = priceQoins?.length ?? 0;
  const priceLabel = `${currency}${(price ?? 0).toLocaleString()} | ${n} Qoin${n === 1 ? '' : 's'}`;

  async function post() {
    setBusy(true);
    setError(undefined);
    try {
      await Q.createPost(level, text.trim());
      setText('');
      onPosted();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    if (!text.trim()) return;
    if (!paid) return post();
    Alert.alert('Paid post', `${priceLabel} — from your wallet. Continue?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: `Post · ${priceLabel}`, onPress: post },
    ]);
  }

  const ready = !!text.trim() && !busy;
  return (
    <View style={styles.composer}>
      <ErrorText>{error}</ErrorText>
      <View style={styles.composerRow}>
        <View style={styles.inputWrap}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={paid ? 'Write a post…' : 'Write to your village…'}
            placeholderTextColor={colors.faint}
            style={styles.composerInput}
            multiline
            maxLength={MAX_POST}
            accessibilityLabel="New post"
          />
          <Text style={styles.count}>{paid ? priceLabel : text.length ? `${text.length}/${MAX_POST}` : 'Free'}</Text>
        </View>
        <Pressable onPress={confirm} disabled={!ready} style={[styles.send, !ready && { opacity: 0.4 }]} accessibilityRole="button" accessibilityLabel="Post">
          {busy ? <ActivityIndicator color={colors.onAccent} /> : <Ionicons name="arrow-up" size={20} color={colors.onAccent} />}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ruleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.sm },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  rule: { flex: 1, color: colors.dim, fontFamily: fonts.medium, fontSize: 11.5 },
  emptyBox: { alignItems: 'center', gap: space.sm, marginTop: space.xxl },
  empty: { color: colors.dim, fontFamily: fonts.body, fontSize: 13, textAlign: 'center' },
  post: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: space.md,
    marginBottom: space.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  postHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  author: { color: colors.text, fontFamily: fonts.bold, fontSize: 13.5 },
  meta: { color: colors.faint, fontFamily: fonts.body, fontSize: 11 },
  scoreBadge: { minWidth: 38, height: 26, borderRadius: 13, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
  score: { fontFamily: fonts.bold, fontSize: 13 },
  origin: { color: colors.saffron, fontFamily: fonts.medium, fontSize: 11, marginTop: 6 },
  content: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 21.5, marginTop: space.sm },
  votes: { flexDirection: 'row', gap: 6, marginTop: space.md },
  voteBtn: {
    flex: 1,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.panelRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voteOn: { backgroundColor: colors.gold },
  voteText: { color: colors.text, fontFamily: fonts.bold, fontSize: 13.5 },
  comments: { marginTop: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  comment: { color: colors.dim, fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginBottom: 4 },
  commentRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 4 },
  commentInput: {
    flex: 1,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.ink,
    paddingHorizontal: space.md,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 13.5,
  },
  composer: { paddingTop: 6, paddingBottom: 6 },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  inputWrap: {
    flex: 1,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    paddingHorizontal: space.md,
    paddingTop: 8,
    paddingBottom: 4,
  },
  composerInput: { maxHeight: 110, minHeight: 22, padding: 0, color: colors.text, fontFamily: fonts.body, fontSize: 14.5 },
  count: { color: colors.faint, fontFamily: fonts.medium, fontSize: 10.5, alignSelf: 'flex-end', marginTop: 2 },
  send: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    right: 0,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    justifyContent: 'center',
    backgroundColor: colors.panelRaised,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: colors.text, fontFamily: fonts.bold, fontSize: 12 },
});
