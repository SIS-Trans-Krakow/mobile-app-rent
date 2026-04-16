import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../constants/theme';

export default function HandoverLayout() {
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
      <Stack.Screen name="index" options={{ title: t('nav.handovers') }} />
      <Stack.Screen name="new" options={{ title: t('handover.new') }} />
      <Stack.Screen name="edit/[id]" options={{ title: t('handover.edit') }} />
      <Stack.Screen name="[id]" options={{ title: t('handover.detail') }} />
    </Stack>
  );
}
