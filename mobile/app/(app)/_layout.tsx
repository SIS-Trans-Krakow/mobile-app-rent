import { Tabs, Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../stores/auth';
import { Colors } from '../../constants/theme';
import { webConstrainedWidthStyle } from '../../constants/layout';

export default function AppLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isLoading, user } = useAuthStore();
  const tabBarBaseHeight = Platform.OS === 'web' ? 64 : 56;
  const tabBarBottomPadding = Platform.OS === 'web' ? 8 : Math.max(insets.bottom, 6);

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          borderTopWidth: 0.5,
          paddingTop: 6,
          paddingBottom: tabBarBottomPadding,
          height: tabBarBaseHeight + (Platform.OS === 'web' ? 0 : insets.bottom),
          ...webConstrainedWidthStyle,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        headerStyle: {
          backgroundColor: Colors.background,
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 0.5,
          borderBottomColor: Colors.border,
          ...webConstrainedWidthStyle,
        },
        headerTintColor: Colors.text,
        headerTitleStyle: { fontWeight: '600', fontSize: 17 },
        sceneStyle: {
          backgroundColor: Colors.background,
          ...webConstrainedWidthStyle,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.dashboard'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="handover"
        options={{
          title: t('nav.handovers'),
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text-outline" size={size} color={color} />,
          headerShown: false,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.replace('/(app)/handover');
          },
        }}
      />
      <Tabs.Screen
        name="return"
        options={{
          title: t('nav.returns'),
          tabBarIcon: ({ color, size }) => <Ionicons name="arrow-undo-outline" size={size} color={color} />,
          headerShown: false,
        }}
        listeners={{
          tabPress: (e) => {
            e.preventDefault();
            router.replace('/(app)/return/select');
          },
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: t('nav.admin'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" size={size} color={color} />,
          headerShown: false,
          href: user?.role === 'admin' ? '/(app)/admin' : null,
        }}
      />
    </Tabs>
  );
}
