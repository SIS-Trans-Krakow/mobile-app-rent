import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
  Alert, Linking, Platform,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import api, { getUploadsUrl } from '../../../services/api';
import { getAccessToken } from '../../../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';
import TrailerTemplate, { ZonePhoto } from '../../../components/TrailerTemplate';

export default function HandoverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const [handover, setHandover] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHandover();
  }, [id]);

  const loadHandover = async () => {
    try {
      const res = await api.get(`/handovers/${id}`);
      setHandover(res.data);
    } catch (err) {
      console.error('Load handover error:', err);
    } finally {
      setLoading(false);
    }
  };

  const generatePdf = async () => {
    try {
      const baseUrl = api.defaults.baseURL?.replace('/api', '');
      const token = getAccessToken();
      const url = `${baseUrl}/api/pdf/handover/${id}?token=${token}`;

      if (Platform.OS === 'web') {
        window.open(url, '_blank');
      } else {
        await Linking.openURL(url);
      }
    } catch (err) {
      Alert.alert(t('common.error'), 'Could not generate PDF');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!handover) {
    return (
      <View style={styles.center}>
        <Text>{t('common.error')}</Text>
      </View>
    );
  }

  const photos: Record<string, ZonePhoto | undefined> = {};
  for (const photo of handover.photos || []) {
    photos[photo.position_on_template] = {
      uri: getUploadsUrl(photo.file_path),
      position: photo.position_on_template,
      description: photo.description,
    };
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerId}>#{handover.id}</Text>
        <View style={[
          styles.badge,
          handover.status === 'active' ? styles.badgeActive : styles.badgeReturned,
        ]}>
          <Text style={styles.badgeText}>
            {handover.status === 'active' ? t('handover.active') : t('handover.returned')}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('handover.company')}</Text>
        <Text style={styles.value}>{handover.company_name}</Text>
        {handover.company_address ? <Text style={styles.detail}>{handover.company_address}</Text> : null}
        {handover.company_phone ? <Text style={styles.detail}>{handover.company_phone}</Text> : null}
        {handover.company_email ? <Text style={styles.detail}>{handover.company_email}</Text> : null}
        {handover.company_contact ? <Text style={styles.detail}>{t('handover.companyContact')}: {handover.company_contact}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('handover.trailer')}</Text>
        <Text style={styles.value}>{handover.registration_number}</Text>
        <Text style={styles.detail}>{t('handover.trailerType')}: {handover.trailer_type}</Text>
        {handover.vin ? <Text style={styles.detail}>VIN: {handover.vin}</Text> : null}
        {handover.brand ? <Text style={styles.detail}>{t('handover.brand')}: {handover.brand}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('handover.date')}</Text>
        <Text style={styles.value}>{handover.handover_date} {handover.handover_time}</Text>
      </View>

      {handover.equipment_notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('handover.equipment')}</Text>
          <Text style={styles.detail}>{handover.equipment_notes}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('handover.photos')}</Text>
        <TrailerTemplate
          photos={photos}
          onZonePress={() => {}}
          readOnly
        />
      </View>

      <TouchableOpacity style={styles.pdfBtn} onPress={generatePdf}>
        <Ionicons name="document" size={20} color={Colors.white} />
        <Text style={styles.pdfBtnText}>{t('handover.generatePdf')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerId: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.primary },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  badgeActive: { backgroundColor: '#dcfce7' },
  badgeReturned: { backgroundColor: Colors.gray100 },
  badgeText: { fontSize: FontSize.sm, fontWeight: '600' },
  section: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },
  value: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  detail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  pdfBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '600' },
});
