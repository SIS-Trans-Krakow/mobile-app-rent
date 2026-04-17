import { useEffect } from 'react';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from '../utils/keyboardController';
import { useAuthStore } from '../stores/auth';
import '../i18n';

export default function RootLayout() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession();
  }, []);

  return (
    <KeyboardProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Slot />
      </SafeAreaProvider>
    </KeyboardProvider>
  );
}
