import { Stack } from 'expo-router';
import { colors } from '@/theme';

/** Registration wizard, same steps as the website: Personal details → Global account → Public account → Review. */
export default function RegisterLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ink } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="global" />
      <Stack.Screen name="public" />
      <Stack.Screen name="review" />
    </Stack>
  );
}
