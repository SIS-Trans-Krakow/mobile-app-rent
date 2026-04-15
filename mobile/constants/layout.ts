import { Platform } from 'react-native';

export const WEB_MAX_CONTENT_WIDTH = 960;
export const WEB_AUTH_MAX_CONTENT_WIDTH = 480;

export const webConstrainedWidthStyle = Platform.OS === 'web'
  ? {
      width: '100%' as const,
      maxWidth: WEB_MAX_CONTENT_WIDTH,
      alignSelf: 'center' as const,
    }
  : {};

export const webAuthConstrainedWidthStyle = Platform.OS === 'web'
  ? {
      width: '100%' as const,
      maxWidth: WEB_AUTH_MAX_CONTENT_WIDTH,
      alignSelf: 'center' as const,
    }
  : {};
