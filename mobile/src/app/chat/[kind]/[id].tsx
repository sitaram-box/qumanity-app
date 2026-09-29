/**
 * One chat screen for all three kinds: a village sub-group ("sub"), a personal
 * group ("group") and a private one-to-one chat ("private"). Text only for now
 * (media needs file storage). Refreshes every few seconds while open.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Q from '@/api/qumanity';
import { BackHeader, Button, ErrorText, Field } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

const POLL_MS = 4000;

type GroupExtra = { category: Q.GroupCategory; is_owner: boolean; members: { name: string; you: boolean }[]; business: { name: string; sector: string; services: string } | null };
type PrivateExtra = { name: string; with: string; left: boolean; other_left: boolean; other_account_id: string | null };

export default function Chat() {
  const { kind, id } = useLocalSearchParams<{ kind: Q.ChatKind; id: string }>();
  const [title, setTitle] = useState('');
  const [messages, setMessages] = useState<Q.ChatMessage[] | null>(null);
  const [extra, setExtra] = useState<GroupExtra | null>(null);
  const [privateExtra, setPrivateExtra] = useState<PrivateExtra | null>(null);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [showInfo, setShowInfo] = useState(false);
  const list = useRef<FlatList<Q.ChatMessage>>(null);

  const load = useCallback(async () => {
    try {
      const r = await Q.chatLoad(kind, Number(id));
      setTitle(r.title);
      setMessages(r.messages);
      if (kind === 'group') setExtra(r.extra as GroupExtra);
      if (kind === 'private') setPrivateExtra(r.extra as PrivateExtra);
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [kind, id]);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      await Q.chatSend(kind, Number(id), body);
      await load();
      requestAnimationFrame(() => list.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setText(body);
      setError((e as Error).message);
    }
  }

  async function requestRejoin() {
    try {
      await Q.requestRejoinChat(Number(id));
      Alert.alert('Request sent', 'Waiting for the other member to let you back in.');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const editable = kind === 'group' && !!extra?.is_owner;
  const locked = kind === 'private' && !!privateExtra?.left;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>
          <BackHeader
            title={title || '…'}
            right={
              kind === 'group' || kind === 'private' ? (
                <Pressable onPress={() => setShowInfo((v) => !v)} accessibilityRole="button" accessibilityLabel="Chat info">
                  <Ionicons name="information-circle" size={26} color={colors.gold} />
                </Pressable>
              ) : null
            }
          />
          {showInfo && extra && <GroupInfo extra={extra} editable={!!editable} groupId={Number(id)} onSaved={load} />}
          {showInfo && kind === 'private' && privateExtra && (
            <PrivateInfo extra={privateExtra} chatId={Number(id)} onSaved={load} onLeft={() => router.replace('/private-groups')} />
          )}
        </View>
        {locked && (
          <View style={styles.lockedBanner}>
            <Text style={styles.lockedText}>You left this chat — you can read the history, but not send or see new messages.</Text>
            <Pressable onPress={requestRejoin} accessibilityRole="button">
              <Text style={styles.lockedLink}>Request to rejoin</Text>
            </Pressable>
          </View>
        )}
        {!messages ? (
          error ? <ErrorText>{error}</ErrorText> : <ActivityIndicator color={colors.gold} style={{ marginTop: space.xl }} />
        ) : (
          <FlatList
            ref={list}
            data={messages}
            keyExtractor={(_, i) => String(i)}
            contentContainerStyle={{ padding: space.lg }}
            onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={<Text style={styles.empty}>No messages yet. Say hello.</Text>}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.mine ? styles.mine : styles.theirs]}>
                {!item.mine && item.who && <Text style={styles.who}>{item.who}</Text>}
                <Text style={[styles.text, item.mine && { color: colors.onAccent }]}>{item.text}</Text>
                <Text style={[styles.at, item.mine && { color: '#1a0f0099' }]}>{shortTime(item.at)}</Text>
              </View>
            )}
          />
        )}
        {messages && <ErrorText>{error}</ErrorText>}
        {!locked && (
          <View style={styles.composer}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="Message"
              placeholderTextColor={colors.faint}
              style={styles.input}
              multiline
              maxLength={4000}
              accessibilityLabel="Message"
            />
            <Pressable onPress={send} style={styles.send} accessibilityRole="button" accessibilityLabel="Send">
              <Ionicons name="send" size={20} color={colors.onAccent} />
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function PrivateInfo({ extra, chatId, onSaved, onLeft }: { extra: PrivateExtra; chatId: number; onSaved: () => void; onLeft: () => void }) {
  const [rename, setRename] = useState('');
  const [msg, setMsg] = useState<string>();

  const save = async () => {
    try {
      await Q.renamePrivateChat(chatId, rename.trim());
      setMsg('Saved.');
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  function confirmLeave() {
    Alert.alert('Leave this chat?', 'You can read the history later, but you will need the other member to let you back in to send messages again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await Q.leavePrivateChat(chatId);
            onLeft();
          } catch (e) {
            setMsg((e as Error).message);
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.info}>
      <Text style={styles.who}>With {extra.with} · both of you are admins</Text>
      {!extra.left && (
        <>
          <Field label="Rename this chat" value={rename} onChangeText={setRename} placeholder={extra.name} />
          <Button title="Save" variant="ghost" onPress={save} />
          <Button title="Leave this chat" variant="ghost" onPress={confirmLeave} style={{ marginTop: space.sm, borderColor: colors.danger }} />
        </>
      )}
      {msg && <Text style={styles.who}>{msg}</Text>}
    </View>
  );
}

function GroupInfo({ extra, editable, groupId, onSaved }: { extra: GroupExtra; editable: boolean; groupId: number; onSaved: () => void }) {
  const [name, setName] = useState(extra.business?.name ?? '');
  const [sector, setSector] = useState(extra.business?.sector ?? '');
  const [services, setServices] = useState(extra.business?.services ?? '');
  const [rename, setRename] = useState('');
  const [msg, setMsg] = useState<string>();

  const save = async () => {
    try {
      if (extra.category === 'business') await Q.saveBusiness(groupId, { name, sector, services });
      else await Q.renameGroup(groupId, rename.trim());
      setMsg('Saved.');
      onSaved();
    } catch (e) {
      setMsg((e as Error).message);
    }
  };

  return (
    <View style={styles.info}>
      <Text style={styles.who}>Members: {extra.members.map((m) => (m.you ? 'You' : m.name)).join(', ')}</Text>
      {editable && extra.category === 'business' && (
        <>
          <Field label="Business name" value={name} onChangeText={setName} />
          <Field label="Sector" value={sector} onChangeText={setSector} />
          <Field label="Services" value={services} onChangeText={setServices} />
        </>
      )}
      {editable && extra.category !== 'business' && <Field label="Rename this group" value={rename} onChangeText={setRename} />}
      {editable && <Button title="Save" variant="ghost" onPress={save} />}
      {msg && <Text style={styles.who}>{msg}</Text>}
    </View>
  );
}

function shortTime(at: string) {
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? '' : `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  empty: { color: colors.dim, fontFamily: fonts.body, textAlign: 'center', marginTop: space.xl },
  bubble: { maxWidth: '82%', borderRadius: radius.lg, padding: space.md, marginBottom: space.sm },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.gold, borderBottomRightRadius: 4 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.panel, borderBottomLeftRadius: 4 },
  who: { color: colors.saffron, fontFamily: fonts.bold, fontSize: 12, marginBottom: 2 },
  text: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 21 },
  at: { color: colors.faint, fontFamily: fonts.body, fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, padding: space.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: radius.lg, backgroundColor: colors.panel, paddingHorizontal: space.lg, paddingVertical: 10, color: colors.text, fontFamily: fonts.body, fontSize: 15 },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  info: { backgroundColor: colors.panel, borderRadius: radius.md, padding: space.md, marginBottom: space.sm },
  lockedBanner: { backgroundColor: colors.panelRaised, paddingHorizontal: space.lg, paddingVertical: space.sm, marginHorizontal: space.lg, borderRadius: radius.md, marginTop: space.sm },
  lockedText: { color: colors.dim, fontFamily: fonts.body, fontSize: 12 },
  lockedLink: { color: colors.gold, fontFamily: fonts.bold, fontSize: 12, marginTop: 4 },
});
