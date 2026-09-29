/**
 * Private timeline: profile, Private ID (masked; PIN to show for 30 s), public
 * search code, wallet, election history, personal details, message box
 * (private chats), posts removed by voting, settings.
 */

import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { PinPrompt } from '@/components/PinPrompt';
import { Avatar, Card, ListRow, Screen, SectionTitle } from '@/components/ui';
import { useApp } from '@/state/app';
import { colors, fonts, radius, space, timelineColors, type } from '@/theme';

const REVEAL_SECONDS = 30;
const group = (s: string, n: number) => s.replace(new RegExp(`(\\d{${n}})(?=\\d)`, 'g'), '$1 ');
const ACCENT = timelineColors.private;

export default function PrivateTimeline() {
  const { me } = useApp();
  const [code, setCode] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [search, setSearch] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [symbol, setSymbol] = useState('₹');
  const [chats, setChats] = useState<Q.PrivateChat[]>([]);
  const [removed, setRemoved] = useState<Awaited<ReturnType<typeof Q.removedPosts>>['posts']>([]);

  useFocusEffect(
    useCallback(() => {
      Q.peopleMe().then((p) => setSearch(p.search_code), () => undefined);
      Q.walletBalance().then((w) => setBalance(w.balance_qoins), () => undefined);
      Q.qoinsConfig().then((c) => setSymbol(c.symbol), () => undefined);
      Q.privateChats().then((c) => setChats(c.chats), () => undefined);
      Q.removedPosts().then((r) => setRemoved(r.posts), () => undefined);
    }, []),
  );

  // The revealed Private ID hides itself again after 30 seconds.
  useEffect(() => {
    if (!code) return;
    const t = setTimeout(() => setCode(null), REVEAL_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [code]);

  if (!me) return null;

  return (
    <Screen>
      <View style={styles.profile}>
        <Avatar name={me.name} size={52} color={ACCENT} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>
            {me.name}
          </Text>
          <Text style={type.small} numberOfLines={1}>
            {me.age_category} · {me.age_years} yrs{me.sun_sign ? ` · ${me.sun_sign} (${me.sun_element})` : ''}
          </Text>
        </View>
      </View>

      <View style={styles.idCard}>
        <View style={styles.idCol}>
          <Text style={type.micro}>PRIVATE ID · SECRET</Text>
          <View style={styles.idRow}>
            <Text style={[styles.idValue, { color: colors.gold }]}>{code ? group(code, 3) : '••• ••• •••'}</Text>
            <Pressable onPress={() => (code ? setCode(null) : setAsking(true))} accessibilityRole="button" accessibilityLabel={code ? 'Hide Private ID' : 'Show Private ID'} hitSlop={10}>
              <Ionicons name={code ? 'eye-off' : 'eye'} size={17} color={colors.dim} />
            </Pressable>
          </View>
        </View>
        <View style={styles.idDivider} />
        <View style={styles.idCol}>
          <Text style={type.micro}>SEARCH CODE · SHARE</Text>
          <Text style={styles.idValue} selectable>
            {search ? group(search, 4) : '…'}
          </Text>
        </View>
      </View>

      <Card>
        <Detail icon="flower-outline" k="Born in" v={me.birth_location} />
        <Detail icon="home-outline" k="Living in" v={me.present_location} />
        {me.moon_sign && <Detail icon="moon-outline" k="Moon · Nakshatra" v={`${me.moon_sign} · ${me.moon_nakshatra ?? ''}`} />}
        {me.ascendant_sign && <Detail icon="sunny-outline" k="Ascendant" v={me.ascendant_sign} />}
        <Detail icon="language-outline" k="Languages" v={me.languages.map((l) => l.native).join(' · ')} last />
      </Card>

      <ListRow icon="swap-horizontal" accent={colors.earth} title="Account IDs" subtitle="Active place · switch · request a new one" onPress={() => router.push('/account-ids')} />
      <ListRow icon="wallet" accent={colors.gold} title="Wallet" subtitle={balance === null ? 'Balance and weekly history' : `${symbol}${balance.toLocaleString()} · weekly history`} onPress={() => router.push('/wallet')} />
      <ListRow icon="checkbox" accent={ACCENT} title="Election history" subtitle="National · State · Q-Punch" onPress={() => router.push('/election-history')} />
      <ListRow icon="planet" accent={colors.violet} title="Time-box & Kundali" subtitle="Panchang · Moon · Kundali · Karma" onPress={() => router.push('/sky')} />
      <ListRow icon="create" accent={colors.saffron} title="Change my profile" subtitle="Name, contact, birth details — council approves" onPress={() => router.push('/profile-change')} />
      <ListRow icon="person-circle" accent={colors.teal} title="Personal details" subtitle="Relationship, work profile" onPress={() => router.push('/personal-details')} />

      <SectionTitle>Message box</SectionTitle>
      {chats.length === 0 ? (
        <Text style={styles.empty}>No private chats yet. Find someone on the Personal tab and send a message request.</Text>
      ) : (
        chats.map((c) => (
          <ListRow
            key={c.chat_id}
            icon="chatbubble-ellipses"
            accent={ACCENT}
            title={c.name}
            subtitle={c.left ? 'You left this chat' : c.last || `Chat with ${c.with}`}
            onPress={() => router.push({ pathname: '/chat/[kind]/[id]', params: { kind: 'private', id: String(c.chat_id) } })}
          />
        ))
      )}

      {removed.length > 0 && (
        <>
          <SectionTitle>My removed posts</SectionTitle>
          {removed.map((p) => (
            <Card key={p.id}>
              <Text style={type.micro}>
                {p.group} · {p.level} · score {p.score}
              </Text>
              <Text style={[type.body, { marginTop: 4 }]}>{p.content}</Text>
            </Card>
          ))}
        </>
      )}

      <SectionTitle>Account</SectionTitle>
      <ListRow icon="settings" accent={colors.dim} title="Settings" subtitle="Language, PIN, server, sign out" onPress={() => router.push('/settings')} />

      <PinPrompt
        visible={asking}
        title="Enter your PIN to show your Private ID"
        onClose={() => setAsking(false)}
        onSubmit={async (pin) => setCode((await Q.revealPrivateId(pin)).private_code)}
      />
    </Screen>
  );
}

function Detail({ icon, k, v, last }: { icon: React.ComponentProps<typeof Ionicons>['name']; k: string; v: string; last?: boolean }) {
  return (
    <View style={[styles.detail, !last && styles.detailLine]}>
      <Ionicons name={icon} size={15} color={colors.faint} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={type.micro}>{k.toUpperCase()}</Text>
        <Text style={styles.detailValue}>{v}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  name: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  idCard: {
    flexDirection: 'row',
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: space.md,
    marginBottom: space.md,
  },
  idCol: { flex: 1, gap: 4 },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  idValue: { color: colors.text, fontFamily: fonts.bold, fontSize: 15, letterSpacing: 0.8 },
  idDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginHorizontal: space.md },
  detail: { flexDirection: 'row', gap: space.sm, paddingVertical: 7 },
  detailLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  detailValue: { color: colors.text, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, marginTop: 1 },
  empty: { color: colors.dim, fontFamily: fonts.body, fontSize: 13 },
});
