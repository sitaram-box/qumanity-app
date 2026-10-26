import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import { useRouter } from 'expo-router';
import { useEffect, useRef, type ComponentProps } from 'react';
import * as Q from '@/api/qumanity';
import DashboardHeader from '@/components/DashboardHeader';
import { colors, fonts, timelineColors } from '@/theme';

type Icon = ComponentProps<typeof Ionicons>['name'];

// Open on Public. Expo Router 58's <Tabs> no longer takes an initialRouteName prop (it would be
// silently ignored and the app would open on Global); this export is the supported way.
export const unstable_settings = { initialRouteName: 'public' };

/** Dashboard: the 4 timelines, in the website's order. */
const TABS: { name: string; title: string; icon: Icon; color: string }[] = [
  { name: 'global', title: 'Global', icon: 'earth', color: timelineColors.global },
  { name: 'public', title: 'Public', icon: 'people', color: timelineColors.public },
  { name: 'personal', title: 'Personal', icon: 'heart', color: timelineColors.personal },
  { name: 'private', title: 'Private', icon: 'lock-closed', color: timelineColors.private },
];

export default function TabsLayout() {
  // First sign-in: the app tour (skippable), then the one-time rating. The rating stays offered
  // on each launch until the member answers it or says "No thanks".
  // useRouter(), not the global `router`: Expo Router 58 binds the global one only after the root
  // has rendered (and unbinds it on remounts), so calling it from a child's mount-time effect
  // throws "The imperative router is unavailable before the first render has finished". The hook's
  // router queues through React context and is valid as soon as this component renders.
  const router = useRouter();
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current) return;
    checked.current = true;
    Q.onboarding().then(
      (s) => {
        if (!s.tour) router.push('/tour');
        else if (!s.review_done) router.push('/rate');
      },
      () => undefined,
    );
  }, [router]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <DashboardHeader />,
        tabBarStyle: { backgroundColor: colors.panel, borderTopColor: colors.line, height: 56, paddingTop: 4 },
        tabBarItemStyle: { paddingVertical: 2 },
        tabBarInactiveTintColor: colors.faint,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 10.5, marginTop: -2 },
        sceneStyle: { backgroundColor: colors.ink },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarActiveTintColor: t.color,
            tabBarIcon: ({ color }) => <Ionicons name={t.icon} color={color as string} size={21} />,
          }}
        />
      ))}
    </Tabs>
  );
}
