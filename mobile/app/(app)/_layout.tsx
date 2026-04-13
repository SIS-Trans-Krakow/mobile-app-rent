import { Tabs, Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/auth';
import { Colors } from '../../constants/theme';

export default function AppLayout() {
  const { t } = useTranslation();
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) return null;
  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.gray400,
        tabBarStyle: { paddingBottom: 4, height: 56 },
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.dashboard'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="handover"
        options={{
          title: t('nav.handovers'),
          tabBarIcon: ({ color, size }) => <Ionicons name="document-text" size={size} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="return"
        options={{
          title: t('nav.returns'),
          tabBarIcon: ({ color, size }) => <Ionicons name="arrow-undo" size={size} color={color} />,
          headerShown: false,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: t('nav.admin'),
          tabBarIcon: ({ color, size }) => <Ionicons name="settings" size={size} color={color} />,
          headerShown: false,
          href: user?.role === 'admin' ? '/(app)/admin' : null,
        }}
      />
    </Tabs>
  );
}
