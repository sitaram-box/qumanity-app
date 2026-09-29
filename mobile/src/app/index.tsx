import { Redirect } from 'expo-router';
import { useApp } from '@/state/app';

export default function Index() {
  const { stage } = useApp();
  return <Redirect href={stage === 'ready' ? '/public' : '/welcome'} />;
}
