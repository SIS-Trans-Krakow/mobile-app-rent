import { Alert, Platform } from 'react-native';

type AlertButton = {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
};

export function showPlatformAlert(
  title: string,
  message: string,
  buttons?: AlertButton[]
) {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (buttons && buttons.length > 1) {
      const confirmed = window.confirm(`${title}\n\n${message}`);
      if (confirmed) {
        const destructiveOrDefault = buttons.find(
          (b) => b.style === 'destructive' || b.style === 'default' || !b.style
        );
        destructiveOrDefault?.onPress?.();
      } else {
        const cancelBtn = buttons.find((b) => b.style === 'cancel');
        cancelBtn?.onPress?.();
      }
    } else {
      window.alert(`${title}\n\n${message}`);
      buttons?.[0]?.onPress?.();
    }
    return;
  }

  Alert.alert(
    title,
    message,
    buttons?.map((b) => ({ text: b.text, style: b.style, onPress: b.onPress }))
  );
}
