/**
 * Character boxes for a one-time code (`otp`, digits only) and a PIN (5 characters: letters,
 * digits or symbols — the website's rule, see pin.logic.ts). One hidden TextInput drives the
 * boxes, so paste and SMS autofill work; `secure` masks what is typed.
 */

import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius } from '@/theme';
import { cleanOtpInput, cleanPinInput } from './pin.logic';

export function CodeInput({
  length,
  value,
  onChange,
  secure,
  autoFocus = true,
  accessibilityLabel,
  otp,
}: {
  length: number;
  value: string;
  onChange: (v: string) => void;
  secure?: boolean;
  autoFocus?: boolean;
  accessibilityLabel: string;
  otp?: boolean;
}) {
  const ref = useRef<React.ComponentRef<typeof TextInput>>(null);
  return (
    <Pressable onPress={() => ref.current?.focus()} style={styles.row} accessibilityLabel={accessibilityLabel}>
      {Array.from({ length }, (_, i) => {
        const ch = value[i];
        const active = i === Math.min(value.length, length - 1);
        return (
          <View key={i} style={[styles.box, active && styles.boxActive]}>
            <Text style={styles.digit}>{ch ? (secure ? '●' : ch) : ''}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={(t) => onChange(otp ? cleanOtpInput(t, length) : cleanPinInput(t))}
        // A PIN can contain letters and symbols, so it needs the full keyboard; a one-time code
        // keeps the number pad. PINs are case-sensitive: no auto-capitalising or auto-correct,
        // and a secure entry so the keyboard never learns or suggests it.
        keyboardType={otp ? 'number-pad' : 'default'}
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        maxLength={length}
        autoFocus={autoFocus}
        textContentType={otp ? 'oneTimeCode' : 'password'}
        autoComplete={otp ? 'sms-otp' : 'off'}
        secureTextEntry={!otp}
        caretHidden
        style={styles.hidden}
        accessibilityLabel={accessibilityLabel}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginVertical: 6 },
  box: {
    width: 44,
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.gold },
  digit: { color: colors.text, fontSize: 20, fontFamily: fonts.bold },
  hidden: { position: 'absolute', opacity: 0, width: 1, height: 1 },
});
