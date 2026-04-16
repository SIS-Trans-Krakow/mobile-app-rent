import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../constants/theme';

export default function AdminLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.background,
        },
        headerShadowVisible: false,
        headerTintColor: Colors.primary,
        headerTitleStyle: { fontWeight: '600', fontSize: 17, color: Colors.text },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('nav.admin') }} />
      <Stack.Screen name="companies" options={{ title: t('admin.clients') }} />
      <Stack.Screen name="company-profile" options={{ title: t('admin.companyProfile') }} />
      <Stack.Screen name="users" options={{ title: t('admin.users') }} />
      <Stack.Screen name="trailers" options={{ title: t('admin.trailers') }} />
    </Stack>
  );
}
