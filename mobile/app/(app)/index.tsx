import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../stores/auth';
import { Colors, Spacing, FontSize, BorderRadius } from '../../constants/theme';

export default function DashboardScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === 'pl' ? 'en' : 'pl');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.welcome}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcomeLabel}>{t('auth.welcome')}</Text>
          <Text style={styles.welcomeName}>{user?.full_name}</Text>
        </View>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={toggleLang} style={styles.iconBtn}>
            <Text style={{ fontSize: 18 }}>{i18n.language === 'pl' ? '🇬🇧' : '🇵🇱'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(app)/profile')}
            style={styles.iconBtn}
            accessibilityLabel={t('profile.menuLabel')}
          >
            <Ionicons name="person-circle-outline" size={22} color={Colors.gray600} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={20} color={Colors.gray500} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => router.push('/(app)/handover/new')}
        activeOpacity={0.7}
      >
        <View style={[styles.actionIcon, { backgroundColor: '#eff6ff' }]}>
          <Ionicons name="add-circle-outline" size={26} color={Colors.primary} />
        </View>
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>{t('dashboard.newHandover')}</Text>
          <Text style={styles.actionDesc}>{t('handover.new')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => router.push('/(app)/return/select')}
        activeOpacity={0.7}
      >
        <View style={[styles.actionIcon, { backgroundColor: '#ecfdf5' }]}>
          <Ionicons name="arrow-undo-circle-outline" size={26} color={Colors.success} />
        </View>
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>{t('dashboard.returnTrailer')}</Text>
          <Text style={styles.actionDesc}>{t('return.title')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.actionCard}
        onPress={() => router.push('/(app)/handover/')}
        activeOpacity={0.7}
      >
        <View style={[styles.actionIcon, { backgroundColor: Colors.gray100 }]}>
          <Ionicons name="list-outline" size={26} color={Colors.gray600} />
        </View>
        <View style={styles.actionContent}>
          <Text style={styles.actionTitle}>{t('dashboard.allHandovers')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingTop: Spacing.sm },
  welcome: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingTop: Spacing.xs,
  },
  welcomeLabel: { fontSize: FontSize.sm, color: Colors.textSecondary },
  welcomeName: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text, marginTop: 2 },
  topActions: { flexDirection: 'row', gap: Spacing.xs },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionContent: { flex: 1, marginLeft: Spacing.md },
  actionTitle: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  actionDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 1 },
});
