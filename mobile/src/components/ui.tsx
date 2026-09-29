/** Shared UI kit: screen shell, headers, text, buttons, fields, chips, cards, list rows, avatar, logo. */

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import type { ComponentProps, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { LOGO_SVG } from '@/brand/logoSvg';
import { colors, fonts, radius, space, tint, type } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({ children, scroll = true, footer }: { children: ReactNode; scroll?: boolean; footer?: ReactNode }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.scroll, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={{ flex: 1 }}>
        {body}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </View>
    </SafeAreaView>
  );
}

/** Back arrow + title for pushed screens. */
export function BackHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={styles.backRow}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={12} style={styles.backBtn}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.backTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={type.small} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** Compact heading for the timeline tabs: a colour dot, title and one-line note. */
export function TabHeading({ title, note, accent, right }: { title: string; note?: string; accent: string; right?: ReactNode }) {
  return (
    <View style={styles.tabHeading}>
      <View style={[styles.tabDot, { backgroundColor: accent }]} />
      <View style={{ flex: 1 }}>
        <Text style={type.heading}>{title}</Text>
        {note ? <Text style={type.small}>{note}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function Logo({ size = 96 }: { size?: number }) {
  return <SvgXml xml={LOGO_SVG} width={size} height={size} />;
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={[type.title, { marginBottom: space.xs }]}>{children}</Text>;
}

export function Lead({ children }: { children: ReactNode }) {
  return <Text style={[type.small, { fontSize: 13.5, lineHeight: 19, marginBottom: space.lg }]}>{children}</Text>;
}

export function Label({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export function ErrorText({ children }: { children?: ReactNode }) {
  return children ? <Text style={styles.error}>{children}</Text> : null;
}

export function Button({
  title,
  onPress,
  disabled,
  busy,
  variant = 'primary',
  icon,
  size = 'md',
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'ghost' | 'soft';
  icon?: IconName;
  size?: 'md' | 'sm';
  style?: StyleProp<ViewStyle>;
}) {
  const fg = variant === 'primary' ? colors.onAccent : colors.gold;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || busy) }}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        size === 'sm' && styles.buttonSm,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'soft' && styles.buttonSoft,
        (disabled || busy) && { opacity: 0.45 },
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon ? <Ionicons name={icon} size={size === 'sm' ? 15 : 18} color={fg} /> : null}
          <Text style={[styles.buttonText, size === 'sm' && { fontSize: 13 }, { color: fg }]}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: space.md }}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={colors.faint}
        selectionColor={colors.gold}
        {...props}
        style={[styles.input, error ? { borderColor: colors.danger } : null, props.multiline ? styles.inputMulti : null, props.style]}
      />
      <ErrorText>{error}</ErrorText>
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && styles.chipOn]}>
      {icon ? <Ionicons name={icon} size={14} color={selected ? colors.onAccent : colors.dim} /> : null}
      <Text style={[styles.chipText, selected && { color: colors.onAccent }]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** A tappable row: tinted icon, title, subtitle, chevron (settings-list style). */
export function ListRow({
  icon,
  accent = colors.gold,
  title,
  subtitle,
  onPress,
  right,
}: {
  icon: IconName;
  accent?: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  right?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.panelRaised }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: tint(accent) }]}>
        <Ionicons name={icon} size={17} color={accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={type.small} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={colors.faint} /> : null)}
    </Pressable>
  );
}

/** Initials in a tinted circle (people have no photos yet). */
export function Avatar({ name, size = 32, color = colors.saffron }: { name: string; size?: number; color?: string }) {
  const parts = name.trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tint(color, '33'), alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color, fontFamily: fonts.bold, fontSize: size * 0.4 }}>{initials || '•'}</Text>
    </View>
  );
}

export function Steps({ at, of }: { at: number; of: number }) {
  return (
    <View style={styles.stepsWrap} accessibilityLabel={`Step ${at} of ${of}`}>
      <View style={styles.steps}>
        {Array.from({ length: of }, (_, i) => (
          <View key={i} style={[styles.step, i < at && { backgroundColor: colors.gold }]} />
        ))}
      </View>
      <Text style={type.micro}>
        STEP {at} OF {of}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.ink },
  scroll: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl, flexGrow: 1 },
  footer: {
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.ink,
  },
  label: { fontFamily: fonts.medium, fontSize: 12, color: colors.dim, marginBottom: 6, letterSpacing: 0.2 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.lg, marginBottom: space.sm },
  sectionTitle: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.faint, letterSpacing: 0.8, textTransform: 'uppercase' },
  error: { fontFamily: fonts.body, fontSize: 12.5, color: colors.danger, marginTop: 6 },
  button: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: space.sm, paddingHorizontal: space.lg },
  buttonSm: { height: 36, paddingHorizontal: space.md, borderRadius: 10 },
  buttonPrimary: { backgroundColor: colors.gold },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  buttonSoft: { backgroundColor: colors.goldSoft },
  buttonText: { fontFamily: fonts.bold, fontSize: 15 },
  input: {
    height: 46,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: space.md,
    color: colors.text,
    fontFamily: fonts.body,
    fontSize: 15,
  },
  inputMulti: { height: 88, paddingTop: 10, textAlignVertical: 'top' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: space.md,
    height: 34,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    marginRight: 6,
    marginBottom: 6,
  },
  chipOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { fontFamily: fonts.medium, color: colors.text, fontSize: 13 },
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: space.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    marginBottom: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    marginBottom: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontFamily: fonts.medium, fontSize: 14.5, color: colors.text },
  stepsWrap: { gap: 6, marginBottom: space.lg },
  steps: { flexDirection: 'row', gap: 5 },
  step: { flex: 1, height: 3, borderRadius: 2, backgroundColor: colors.line },
  backRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.panel,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  backTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  tabHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  tabDot: { width: 8, height: 8, borderRadius: 4 },
});
