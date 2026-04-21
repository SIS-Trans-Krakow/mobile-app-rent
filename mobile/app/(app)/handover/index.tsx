import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, TextInput,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { useConnectivityStore } from '../../../stores/connectivity';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';
import { calculateRentalFullDays, calculateRentalFullDaysElapsed } from '../../../utils/rentalDuration';

interface HandoverItem {
  id: number;
  handover_date: string;
  handover_time: string;
  return_date?: string | null;
  return_time?: string | null;
  company_name: string;
  registration_number: string;
  trailer_type: string;
  status: string;
  issue_count?: number;
}

function getListRentalDayCount(item: HandoverItem): number | null {
  const st = String(item.status ?? '').trim().toLowerCase();
  if (st === 'active') {
    return calculateRentalFullDaysElapsed(item.handover_date, item.handover_time);
  }
  if (st === 'returned') {
    return calculateRentalFullDays(
      item.handover_date,
      item.handover_time,
      item.return_date ?? null,
      item.return_time ?? null,
    );
  }
  return null;
}

type StatusFilter = 'all' | 'active' | 'returned';

export default function HandoverListScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [handovers, setHandovers] = useState<HandoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [registrationQuery, setRegistrationQuery] = useState('');
  const retryToken = useConnectivityStore((s) => s.retryToken);
  const isOffline = useConnectivityStore((s) => s.isOffline);

  useFocusEffect(
    useCallback(() => {
      loadHandovers();
    }, [retryToken])
  );

  const loadHandovers = async () => {
    try {
      setLoadError(false);
      const res = await api.get('/handovers');
      const rows = (res.data as Record<string, unknown>[]).map((h) => {
        const raw = h as Record<string, unknown>;
        return {
          ...raw,
          status: String(raw.status ?? '').trim().toLowerCase(),
          return_date: (raw.return_date ?? raw.returnDate ?? null) as string | null | undefined,
          return_time: (raw.return_time ?? raw.returnTime ?? null) as string | null | undefined,
        } as HandoverItem;
      });
      setHandovers(rows);
    } catch (err) {
      console.error('Load handovers error:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  const normalizedQuery = registrationQuery.trim().toUpperCase();
  const filteredHandovers = handovers.filter((item) => {
    const st = String(item.status ?? '').trim().toLowerCase();
    const matchesStatus = statusFilter === 'all' || st === statusFilter;
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
          (loadError || isOffline) ? (
            <View style={styles.errorBox}>
              <Ionicons name="cloud-offline-outline" size={40} color={Colors.danger} />
              <Text style={styles.errorTitle}>{t('connectivity.offlineTitle')}</Text>
              <Text style={styles.errorSubtitle}>{t('connectivity.loadError')}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={loadHandovers}
                accessibilityRole="button"
              >
                <Ionicons name="refresh" size={16} color={Colors.white} />
                <Text style={styles.retryBtnText}>{t('connectivity.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={styles.empty}>{t('common.noData')}</Text>
          )
        }
        renderItem={({ item }) => {
          const rentalDays = getListRentalDayCount(item);
          const isReturned = String(item.status ?? '').trim().toLowerCase() === 'returned';
          const returnWhen = [item.return_date, item.return_time]
            .map((v) => (v != null ? String(v).trim() : ''))
            .filter(Boolean)
            .join(' ');
          return (
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
                    String(item.status ?? '').trim().toLowerCase() === 'active'
                      ? styles.badgeActive
                      : styles.badgeReturned,
                  ]}>
                    <Text style={styles.badgeText}>
                      {String(item.status ?? '').trim().toLowerCase() === 'active'
                        ? t('handover.active')
                        : t('handover.returned')}
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
              {isReturned ? (
                <View style={styles.cardReturnedMeta}>
                  {returnWhen ? (
                    <View style={styles.cardRow}>
                      <Ionicons name="return-down-back" size={14} color={Colors.primary} />
                      <Text style={styles.cardDetail}>{returnWhen}</Text>
                    </View>
                  ) : null}
                  {rentalDays !== null ? (
                    <View style={styles.cardRow}>
                      <Ionicons name="time-outline" size={14} color={Colors.gray500} />
                      <Text style={styles.cardDetail}>
                        {t('return.rentalDuration')}: {t('return.rentalDurationDays', { count: rentalDays })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : rentalDays !== null ? (
                <View style={styles.cardRow}>
                  <Ionicons name="time-outline" size={14} color={Colors.gray500} />
                  <Text style={styles.cardDetail}>
                    {t('handover.listRentalActive', {
                      duration: t('return.rentalDurationDays', { count: rentalDays }),
                    })}
                  </Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        }}
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
  errorBox: {
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    gap: Spacing.xs,
  },
  errorTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  errorSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  retryBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: FontSize.sm,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardReturnedMeta: {
    width: '100%',
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
