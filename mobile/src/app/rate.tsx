/**
 * The one-time rating: 1–5 stars and a review of up to 100 characters. Every member gets this
 * one chance, whether they finished or skipped the tour; "No thanks" also uses it. The review is
 * shown publicly (first name + village) only if the member allows it and an admin approves it.
 */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Q from '@/api/qumanity';
import { Button, ErrorText, Logo, Screen } from '@/components/ui';
import { colors, fonts, radius, space } from '@/theme';

const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export default function Rate() {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const [allowPublic, setAllowPublic] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [thanks, setThanks] = useState(false);

  const done = () => (router.canGoBack() ? router.back() : router.replace('/public'));

  async function submit() {
    setBusy(true);
    setError(undefined);
    try {
      await Q.submitReview(stars, text.trim(), allowPublic);
      setThanks(true);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) return done(); // already rated on another device
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function noThanks() {
    try {
      await Q.declineReview();
    } finally {
      done();
    }
  }

  if (thanks) {
    return (
      <Screen footer={<Button title="Continue" icon="arrow-forward" onPress={done} />}>
        <View style={styles.center}>
          <Logo size={96} />
          <Text style={styles.title}>Thank you!</Text>
          <Text style={styles.sub}>Your {stars}-star rating helps Qumanity reach more villages.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View style={{ gap: space.sm }}>
          <Button title="Share my rating" icon="send" onPress={submit} disabled={!stars} busy={busy} />
          <Button title="No thanks" variant="ghost" onPress={noThanks} />
        </View>
      }
    >
      <View style={styles.center}>
        <Logo size={72} />
        <Text style={styles.title}>How do you like Qumanity?</Text>
        <Text style={styles.sub}>We ask only once. Your rating helps us improve and grow.</Text>
      </View>

      <View style={styles.stars} accessibilityRole="adjustable" accessibilityLabel={`Rating: ${stars} of 5 stars`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} hitSlop={6}>
            <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={40} color={n <= stars ? colors.gold : colors.faint} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.word}>{WORDS[stars] || 'Tap a star'}</Text>

      <View style={styles.box}>
        <TextInput
          value={text}
          onChangeText={setText}
          maxLength={Q.REVIEW_MAX_CHARS}
          multiline
          placeholder="Your review in a line (optional)"
          placeholderTextColor={colors.faint}
          style={styles.input}
          accessibilityLabel="Review, up to 100 characters"
        />
        <Text style={[styles.counter, text.length >= Q.REVIEW_MAX_CHARS && { color: colors.saffron }]}>
          {text.length}/{Q.REVIEW_MAX_CHARS}
        </Text>
      </View>

      <Pressable
        style={styles.consent}
        onPress={() => setAllowPublic((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: allowPublic }}
      >
        <View style={[styles.checkbox, allowPublic && styles.checkboxOn]}>{allowPublic && <Ionicons name="checkmark" size={13} color={colors.onAccent} />}</View>
        <Text style={styles.consentText}>Qumanity may show my review publicly, with my first name and village.</Text>
      </Pressable>
      <ErrorText>{error}</ErrorText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', marginTop: space.lg },
  title: { color: colors.text, fontFamily: fonts.displayBold, fontSize: 22, marginTop: space.md, textAlign: 'center' },
  sub: { color: colors.dim, fontFamily: fonts.body, fontSize: 13.5, lineHeight: 19, textAlign: 'center', marginTop: space.xs },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: space.sm, marginTop: space.xl },
  word: { color: colors.gold, fontFamily: fonts.bold, fontSize: 14, textAlign: 'center', marginTop: space.sm, marginBottom: space.lg },
  box: { backgroundColor: colors.panel, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: space.md },
  input: { minHeight: 64, color: colors.text, fontFamily: fonts.body, fontSize: 15, textAlignVertical: 'top', padding: 0 },
  counter: { alignSelf: 'flex-end', color: colors.faint, fontFamily: fonts.medium, fontSize: 11 },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, marginTop: space.md },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkboxOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  consentText: { flex: 1, color: colors.dim, fontFamily: fonts.body, fontSize: 12.5, lineHeight: 18 },
});
