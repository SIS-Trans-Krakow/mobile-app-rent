import { useState } from 'react';
import axios from 'axios';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../stores/auth';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';
import { webAuthConstrainedWidthStyle } from '../../constants/layout';

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const login = useAuthStore((s) => s.login);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const showLoginDebug = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      // No HTTP response means we couldn't reach the backend at all - show a
      // friendly, localized message instead of the developer-style debug
      // dump (the global offline banner is already showing too).
      if (!error.response) {
        Alert.alert(t('connectivity.offlineTitle'), t('connectivity.offlineSubtitle'));
        return;
      }

      const requestUrl = `${error.config?.baseURL ?? ''}${error.config?.url ?? ''}`;
      const responseData =
        typeof error.response?.data === 'string'
          ? error.response.data
          : error.response?.data
            ? JSON.stringify(error.response.data)
            : error.message;

      console.error('Login debug', {
        requestUrl,
        method: error.config?.method,
        status: error.response?.status,
        responseData: error.response?.data,
        message: error.message,
      });

      Alert.alert(
        t('common.error'),
        [
          `URL: ${requestUrl || 'unknown'}`,
          `Status: ${error.response?.status ?? 'no response'}`,
          `Method: ${error.config?.method?.toUpperCase() ?? 'unknown'}`,
          `Response: ${responseData || 'empty'}`,
        ].join('\n')
      );
      return;
    }

    console.error('Login debug', error);
    Alert.alert(t('common.error'), String(error));
  };

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    try {
      await login(username.trim(), password);
      router.replace('/(app)');
    } catch (error) {
      showLoginDebug(error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'pl' ? 'en' : 'pl');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.inner, webAuthConstrainedWidthStyle]}>
        <View style={styles.header}>
          <Text style={styles.icon}>🚛</Text>
          <Text style={styles.title}>Trailer Handover</Text>
          <Text style={styles.subtitle}>{t('auth.login')}</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>{t('auth.username')}</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('auth.username')}
            placeholderTextColor={Colors.gray400}
          />

          <Text style={styles.label}>{t('auth.password')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={t('auth.password')}
            placeholderTextColor={Colors.gray400}
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.buttonText}>{t('auth.loginButton')}</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity onPress={toggleLang} style={styles.langButton}>
          <Text style={styles.langText}>
            {i18n.language === 'pl' ? '🇬🇧 English' : '🇵🇱 Polski'}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  icon: {
    fontSize: 56,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
  },
  form: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gray700,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  input: {
    backgroundColor: Colors.gray50,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  langButton: {
    alignSelf: 'center',
    marginTop: Spacing.lg,
    padding: Spacing.sm,
  },
  langText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
});
