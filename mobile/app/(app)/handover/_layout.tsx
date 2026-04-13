import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../../constants/theme';

export default function HandoverLayout() {
  const { t } = useTranslation();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: Colors.white,
        headerTitleStyle: { fontWeight: '600' },
      }}
    >
      <Stack.Screen name="index" options={{ title: t('nav.handovers') }} />
      <Stack.Screen name="new" options={{ title: t('handover.new') }} />
      <Stack.Screen name="[id]" options={{ title: t('handover.detail') }} />
    </Stack>
  );
}
