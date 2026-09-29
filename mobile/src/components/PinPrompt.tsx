/**
 * Asks for the 5-digit PIN again before showing something private. Submits by itself on the 5th
 * digit, and sits near the top of the screen, because a pop-up is not lifted by the app's keyboard
 * handling: centred, the keyboard used to cover its Continue button so "nothing happened".
 */

import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, space } from '@/theme';
import { CodeInput } from './CodeInput';
import { Button, ErrorText } from './ui';

export function PinPrompt({
  visible,
  title,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  /** Throw to show the error and let the person try again. */
  onSubmit: (pin: string) => Promise<void>;
  onClose: () => void;
}) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(value = pin) {
    if (busy || value.length !== 5) return;
    setBusy(true);
    setError(undefined);
    try {
      await onSubmit(value);
      setPin('');
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <Text style={styles.title}>{title}</Text>
          <CodeInput
            length={5}
            secure
            value={pin}
            onChange={(v) => {
              setPin(v);
              if (v.length === 5) submit(v);
            }}
            accessibilityLabel="PIN"
          />
          <ErrorText>{error}</ErrorText>
          <Button title="Continue" onPress={() => submit()} disabled={pin.length !== 5} busy={busy} style={{ marginTop: space.lg }} />
          <Pressable onPress={onClose} accessibilityRole="button" style={{ alignSelf: 'center', marginTop: space.md }}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000b', justifyContent: 'flex-start', paddingHorizontal: space.xl, paddingTop: '18%' },
  box: { backgroundColor: colors.ink, borderRadius: 18, padding: space.xl, borderWidth: 1, borderColor: colors.line },
  title: { color: colors.text, fontFamily: fonts.bold, fontSize: 17, marginBottom: space.md, textAlign: 'center' },
  cancel: { color: colors.gold, fontFamily: fonts.medium },
});
