import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';

export default function AdminMenuScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/(app)/admin/users')}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: '#eff6ff' }]}>
          <Ionicons name="people-outline" size={28} color={Colors.primary} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{t('admin.manageUsers')}</Text>
          <Text style={styles.cardDescription}>{t('admin.manageUsersDesc')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/(app)/admin/company-profile')}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: '#f5f3ff' }]}>
          <Ionicons name="business-outline" size={28} color="#7c3aed" />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{t('admin.companyProfile')}</Text>
          <Text style={styles.cardDescription}>{t('admin.companyProfileDesc')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push('/(app)/admin/trailers')}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, { backgroundColor: '#f0fdf4' }]}>
          <Ionicons name="bus-outline" size={28} color={Colors.success} />
        </View>
        <View style={styles.cardContent}>
          <Text style={styles.cardTitle}>{t('admin.manageTrailers')}</Text>
          <Text style={styles.cardDescription}>{t('admin.manageTrailersDesc')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  cardDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
