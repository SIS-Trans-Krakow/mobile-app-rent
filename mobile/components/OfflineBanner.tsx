import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useConnectivityStore } from '../stores/connectivity';
import { pingHealth } from '../services/api';
import { Colors, FontSize, Spacing } from '../constants/theme';

const POLL_INTERVAL_MS = 5000;

/**
 * Global, sticky banner anchored at the top of the screen. Visible only when
 * the API is unreachable. While shown, it polls `/api/health` every few
 * seconds and exposes a manual "Try again" action.
 */
export default function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isOffline = useConnectivityStore((s) => s.isOffline);
  const isChecking = useConnectivityStore((s) => s.isChecking);

  const translateY = useRef(new Animated.Value(-120)).current;
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOffline ? 0 : -120,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [isOffline, translateY]);

  // While offline, poll the backend in the background so the banner clears
  // automatically as soon as the server comes back.
  useEffect(() => {
    if (!isOffline) {
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
      return;
    }

    pollerRef.current = setInterval(() => {
      pingHealth().catch(() => undefined);
    }, POLL_INTERVAL_MS);

    return () => {
      if (pollerRef.current) {
        clearInterval(pollerRef.current);
        pollerRef.current = null;
      }
    };
  }, [isOffline]);

  // Probe immediately when the app comes back to the foreground.
  useEffect(() => {
    const handler = (state: AppStateStatus) => {
      if (state === 'active' && useConnectivityStore.getState().isOffline) {
        pingHealth().catch(() => undefined);
      }
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, []);

  const handleRetry = () => {
    pingHealth().catch(() => undefined);
  };

  return (
    <Animated.View
      pointerEvents={isOffline ? 'auto' : 'none'}
      style={[
        styles.container,
        { paddingTop: insets.top + Spacing.xs, transform: [{ translateY }] },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
    >
      <View style={styles.row}>
        <Ionicons name="cloud-offline-outline" size={20} color={Colors.white} />
        <View style={styles.textWrap}>
          <Text style={styles.title}>{t('connectivity.offlineTitle')}</Text>
          <Text style={styles.subtitle}>{t('connectivity.offlineSubtitle')}</Text>
        </View>
        <TouchableOpacity
          onPress={handleRetry}
          disabled={isChecking}
          style={[styles.retryBtn, isChecking && styles.retryBtnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t('connectivity.retry')}
        >
          {isChecking ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <>
              <Ionicons name="refresh" size={14} color={Colors.white} />
              <Text style={styles.retryText}>{t('connectivity.retry')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.danger,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    zIndex: 9999,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  textWrap: { flex: 1 },
  title: { color: Colors.white, fontWeight: '700', fontSize: FontSize.sm },
  subtitle: { color: Colors.white, opacity: 0.9, fontSize: FontSize.xs, marginTop: 1 },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.25)',
    minWidth: 84,
    justifyContent: 'center',
  },
  retryBtnDisabled: { opacity: 0.7 },
  retryText: { color: Colors.white, fontSize: FontSize.xs, fontWeight: '700' },
});
