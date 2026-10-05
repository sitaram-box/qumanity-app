import { Fraunces_600SemiBold, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold, useFonts } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Keyboard, Platform, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import PoemsMarquee from '@/components/PoemsMarquee';
import { Logo } from '@/components/ui';
import { AppProvider, useApp } from '@/state/app';
import { colors } from '@/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({ Fraunces_600SemiBold, Fraunces_700Bold, Inter_400Regular, Inter_500Medium, Inter_700Bold });
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <BottomMarqueeLayout showMarquee={fontsLoaded}>
          <Navigator ready={fontsLoaded} />
        </BottomMarqueeLayout>
      </AppProvider>
    </SafeAreaProvider>
  );
}

/**
 * The poems marquee is the bottom strip of every screen (signed in or out), under the tab bar,
 * and it never hides: while a keyboard is open the whole app — marquee included — sits above
 * the keyboard, so the message box is above the marquee and the marquee just above the keys.
 * This one place handles the keyboard for every screen (Android draws edge-to-edge and does not
 * resize the window by itself). Screens above no longer touch the bottom edge, so their bottom
 * safe-area inset is 0 (SafeAreaView measures that itself; hook users, like the tab bar, get it
 * from this context).
 */
function BottomMarqueeLayout({ showMarquee, children }: { showMarquee: boolean; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [keyboard, setKeyboard] = useState(0);

  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setKeyboard(e.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboard(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <SafeAreaInsetsContext.Provider value={{ ...insets, bottom: 0 }}>
        <View style={{ flex: 1 }}>{children}</View>
      </SafeAreaInsetsContext.Provider>
      {/* Android reports the keyboard height without the system navigation bar; iOS includes it. */}
      <View
        style={{
          paddingBottom: keyboard > 0 ? keyboard + (Platform.OS === 'android' ? insets.bottom : 0) : insets.bottom,
          backgroundColor: colors.panel,
        }}
      >
        {showMarquee && <PoemsMarquee />}
      </View>
    </View>
  );
}

/** Signed out: welcome, sign-in, registration, recovery. Signed in: the 4 timelines and their screens. */
function Navigator({ ready }: { ready: boolean }) {
  const { stage } = useApp();
  if (!ready || stage === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', gap: 24 }}>
        <Logo size={120} />
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  const signedIn = stage === 'ready';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="founders-message" />
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="forgot-pin" />
        <Stack.Screen name="recover-id" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="tour" options={{ animation: 'fade' }} />
        <Stack.Screen name="rate" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="chat/[kind]/[id]" />
        <Stack.Screen name="groups/[category]" />
        <Stack.Screen name="groups/create" />
        <Stack.Screen name="private-groups" />
        <Stack.Screen name="personal-details" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="wallet" />
        <Stack.Screen name="account-ids" />
        <Stack.Screen name="council" />
        <Stack.Screen name="election-history" />
        <Stack.Screen name="sky" />
        <Stack.Screen name="profile-change" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="place/[level]/[id]" />
      </Stack.Protected>
    </Stack>
  );
}
