/**
 * The Founder's Message (website /founders-message, founder_core.py) — in the member's preferred
 * language when a translation exists, else English. "## " lines are section headings.
 */

import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import * as Q from '@/api/qumanity';
import { BackHeader, ErrorText, Screen } from '@/components/ui';
import { useApp } from '@/state/app';
import { colors, fonts, space } from '@/theme';

export default function FoundersMessage() {
  const { me } = useApp();
  const [msg, setMsg] = useState<Q.FounderMessage | null>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    Q.founderMessage(me?.preferred_language || 'en').then(setMsg, (e) => setError((e as Error).message));
  }, [me?.preferred_language]);

  return (
    <Screen>
      <BackHeader title={msg?.title ?? "Founder's Message"} />
      <ErrorText>{error}</ErrorText>
      {!msg && !error && <ActivityIndicator color={colors.gold} style={{ marginTop: space.xl }} />}
      {msg?.full_text.split(/\n{2,}/).map((block, i) =>
        block.startsWith('## ') ? (
          <Text key={i} style={styles.h}>{block.slice(3).trim()}</Text>
        ) : (
          <Text key={i} style={styles.p}>{block.trim()}</Text>
        ),
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  h: { color: colors.gold, fontFamily: fonts.display, fontSize: 19, marginTop: space.lg, marginBottom: space.sm },
  p: { color: colors.text, fontFamily: fonts.body, fontSize: 15, lineHeight: 24, marginBottom: space.md },
});
