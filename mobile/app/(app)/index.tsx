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
        <Text style={styles.welcomeText}>
          {t('auth.welcome')}, {user?.full_name}
        </Text>
        <View style={styles.topActions}>
          <TouchableOpacity onPress={toggleLang} style={styles.iconBtn}>
            <Text style={{ fontSize: 20 }}>{i18n.language === 'pl' ? '🇬🇧' : '🇵🇱'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleLogout} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" size={22} color={Colors.gray600} />
          </TouchableOpacity>
        </View>
      </View>

      <TouchableOpacity
        style={[styles.card, { backgroundColor: Colors.primary }]}
        onPress={() => router.push('/(app)/handover/new')}
      >
        <Ionicons name="add-circle" size={40} color={Colors.white} />
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: Colors.white }]}>{t('dashboard.newHandover')}</Text>
          <Text style={[styles.cardDesc, { color: 'rgba(255,255,255,0.8)' }]}>
            {t('handover.new')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.card, { backgroundColor: Colors.success }]}
        onPress={() => router.push('/(app)/return/select')}
      >
        <Ionicons name="arrow-undo-circle" size={40} color={Colors.white} />
        <View style={styles.cardContent}>
          <Text style={[styles.cardTitle, { color: Colors.white }]}>{t('dashboard.returnTrailer')}</Text>
          <Text style={[styles.cardDesc, { color: 'rgba(255,255,255,0.8)' }]}>
            {t('return.title')}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color="rgba(255,255,255,0.8)" />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cardLight}
        onPress={() => router.push('/(app)/handover/')}
      >
        <Ionicons name="list" size={32} color={Colors.primary} />
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{t('dashboard.allHandovers')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={Colors.gray400} />
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  welcome: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  welcomeText: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text, flex: 1 },
  topActions: { flexDirection: 'row', gap: Spacing.sm },
  iconBtn: { padding: Spacing.xs },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardLight: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardContent: { flex: 1, marginLeft: Spacing.md },
  cardTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  cardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});
