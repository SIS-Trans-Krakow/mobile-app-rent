import { Alert, Platform } from 'react-native';

export function showPlatformAlert(title: string, message: string) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(message);
    return;
  }

  Alert.alert(title, message);
}
