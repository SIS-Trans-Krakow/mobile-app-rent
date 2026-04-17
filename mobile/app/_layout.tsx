import { useEffect } from 'react';
import { View } from 'react-native';
import { Slot } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from '../utils/keyboardController';
import { useAuthStore } from '../stores/auth';
import { pingHealth } from '../services/api';
import OfflineBanner from '../components/OfflineBanner';
import '../i18n';

export default function RootLayout() {
  const restoreSession = useAuthStore((s) => s.restoreSession);

  useEffect(() => {
    restoreSession();
    // Probe the backend at startup so the offline banner can appear before
    // the first user action even if no API call has been issued yet.
    pingHealth().catch(() => undefined);
  }, []);

  return (
    <KeyboardProvider>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <View style={{ flex: 1 }}>
          <Slot />
          <OfflineBanner />
        </View>
      </SafeAreaProvider>
    </KeyboardProvider>
  );
}
