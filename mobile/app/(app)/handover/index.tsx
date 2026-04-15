import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';

interface HandoverItem {
  id: number;
  handover_date: string;
  handover_time: string;
  company_name: string;
  registration_number: string;
  trailer_type: string;
  status: string;
  issue_count?: number;
}

type StatusFilter = 'all' | 'active' | 'returned';

export default function HandoverListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [handovers, setHandovers] = useState<HandoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [registrationQuery, setRegistrationQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadHandovers();
    }, [])
  );

  const loadHandovers = async () => {
    try {
      const res = await api.get('/handovers');
      setHandovers(res.data);
    } catch (err) {
      console.error('Load handovers error:', err);
    } finally {
      setLoading(false);
    }
  };

  const normalizedQuery = registrationQuery.trim().toUpperCase();
  const filteredHandovers = handovers.filter((item) => {
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesRegistration = !normalizedQuery
      || item.registration_number.toUpperCase().includes(normalizedQuery);

    return matchesStatus && matchesRegistration;
  });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filters}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={Colors.gray400} />
          <TextInput
            style={styles.searchInput}
            value={registrationQuery}
            onChangeText={setRegistrationQuery}
            placeholder={t('handover.filterByRegistration')}
            placeholderTextColor={Colors.gray400}
            autoCapitalize="characters"
          />
        </View>

        <View style={styles.statusRow}>
          {(['all', 'active', 'returned'] as StatusFilter[]).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                statusFilter === filter && styles.filterChipActive,
              ]}
              onPress={() => setStatusFilter(filter)}
              accessibilityRole="button"
              accessible
              accessibilityLabel={
                filter === 'all'
                  ? t('handover.filterAll')
                  : filter === 'active'
                    ? t('handover.active')
                    : t('handover.returned')
              }
              accessibilityState={{ selected: statusFilter === filter }}
            >
              <Text
                style={[
                  styles.filterChipText,
                  statusFilter === filter && styles.filterChipTextActive,
                ]}
              >
                {filter === 'all'
                  ? t('handover.filterAll')
                  : filter === 'active'
                    ? t('handover.active')
                    : t('handover.returned')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredHandovers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>{t('common.noData')}</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(app)/handover/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.cardId}>#{item.id}</Text>
              <View style={styles.cardHeaderRight}>
                {item.issue_count ? (
                  <View style={styles.issueBadge}>
                    <Ionicons name="warning" size={12} color={Colors.white} />
                    <Text style={styles.issueBadgeText}>{item.issue_count}</Text>
                  </View>
                ) : null}
                <View style={[
                  styles.badge,
                  item.status === 'active' ? styles.badgeActive : styles.badgeReturned,
                ]}>
                  <Text style={styles.badgeText}>
                    {item.status === 'active' ? t('handover.active') : t('handover.returned')}
                  </Text>
                </View>
              </View>
            </View>
            <Text style={styles.cardCompany}>{item.company_name}</Text>
            <View style={styles.cardRow}>
              <Ionicons name="car" size={14} color={Colors.gray500} />
              <Text style={styles.cardDetail}>
                {item.registration_number} ({item.trailer_type})
              </Text>
            </View>
            <View style={styles.cardRow}>
              <Ionicons name="calendar" size={14} color={Colors.gray500} />
              <Text style={styles.cardDetail}>
                {item.handover_date} {item.handover_time}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/(app)/handover/new')}
      >
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  filters: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    gap: Spacing.sm,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
  },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  statusRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  filterChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterChipText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: Colors.white,
  },
  list: { padding: Spacing.md },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: Spacing.xl },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  cardId: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeReturned: { backgroundColor: Colors.gray100 },
  badgeText: { fontSize: FontSize.xs, fontWeight: '600' },
  issueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.warning,
  },
  issueBadgeText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  cardCompany: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text, marginBottom: Spacing.xs },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: 2 },
  cardDetail: { fontSize: FontSize.sm, color: Colors.textSecondary },
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
});
