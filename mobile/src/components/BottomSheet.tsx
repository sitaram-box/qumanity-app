/**
 * The app's one bottom-sheet shell: a dimmed backdrop, a sheet sliding up from the bottom, and room
 * under its content for the Android navigation bar (or the iOS home indicator).
 *
 * Why the sheet measures that room itself: a Modal is a separate window, and the app's root layout
 * reports a bottom inset of 0 to every screen (it handles the bottom strip itself). Without its own
 * SafeAreaProvider, a sheet's last rows and buttons sat behind the Android navigation bar — seen on a
 * real phone: the Person sheet's Add buttons and the Members list's last members couldn't be reached.
 * A ScrollView inside the sheet shrinks to the space left above that room, so lists scroll all the
 * way clear of the bar.
 *
 * Used by every bottom sheet: FamilyPersonSheet, MembersSheet, QPunchSheet and the Family Tree's
 * "Who is…?" link sheet. The caller's `style` adds its own padding / gap / maxHeight.
 */

import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';

export function BottomSheet({
  visible,
  onClose,
  style,
  children,
}: {
  visible: boolean;
  /** Android back button / iOS swipe-down. */
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.sheet, style]}>
            {children}
            <NavBarSpacer />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </Modal>
  );
}

/** The navigation bar / home indicator height; 0 where there's nothing to clear. */
function NavBarSpacer() {
  const { bottom } = useSafeAreaInsets();
  return <View style={{ height: bottom }} />;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.ink,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
});
