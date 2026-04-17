import { useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { useConnectivityStore } from '../../../stores/connectivity';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';

interface HandoverItem {
  id: number;
  handover_date: string;
  handover_time: string;
  company_name: string;
  registration_number: string;
  trailer_type: string;
  issue_count?: number;
}

export default function SelectHandoverScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [handovers, setHandovers] = useState<HandoverItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const retryToken = useConnectivityStore((s) => s.retryToken);
  const isOffline = useConnectivityStore((s) => s.isOffline);

  useFocusEffect(
    useCallback(() => {
      loadActive();
    }, [retryToken])
  );

  const loadActive = async () => {
    try {
      setLoadError(false);
      const res = await api.get('/handovers', { params: { status: 'active' } });
      setHandovers(res.data);
    } catch (err) {
      console.error('Load active handovers error:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={handovers}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          (loadError || isOffline) ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cloud-offline-outline" size={48} color={Colors.danger} />
              <Text style={styles.errorTitle}>{t('connectivity.offlineTitle')}</Text>
              <Text style={styles.errorSubtitle}>{t('connectivity.loadError')}</Text>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={loadActive}
                accessibilityRole="button"
              >
                <Ionicons name="refresh" size={16} color={Colors.white} />
                <Text style={styles.retryBtnText}>{t('connectivity.retry')}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="checkmark-circle" size={48} color={Colors.success} />
              <Text style={styles.empty}>{t('common.noData')}</Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(app)/return/${item.id}`)}
          >
            <View style={styles.cardLeft}>
              <Ionicons name="swap-horizontal" size={28} color={Colors.primary} />
            </View>
            <View style={styles.cardContent}>
              <Text style={styles.cardCompany}>{item.company_name}</Text>
              {item.issue_count ? (
                <View style={styles.issueBadge}>
                  <Ionicons name="warning" size={12} color={Colors.white} />
                  <Text style={styles.issueBadgeText}>{item.issue_count}</Text>
                </View>
              ) : null}
              <Text style={styles.cardTrailer}>
                {item.registration_number} ({item.trailer_type})
              </Text>
              <Text style={styles.cardDate}>
                {item.handover_date} {item.handover_time}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.gray400} />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: Spacing.md },
  emptyContainer: { alignItems: 'center', marginTop: Spacing.xxl, paddingHorizontal: Spacing.lg },
  empty: { textAlign: 'center', color: Colors.textSecondary, marginTop: Spacing.md, fontSize: FontSize.md },
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
    marginTop: 4,
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
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLeft: { marginRight: Spacing.md },
  cardContent: { flex: 1 },
  cardCompany: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  issueBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
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
  cardTrailer: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  cardDate: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
});
