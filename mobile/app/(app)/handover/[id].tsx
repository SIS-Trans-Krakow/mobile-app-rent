import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity,
  Alert, Linking, Platform, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import api, { getUploadsUrl } from '../../../services/api';
import { getAccessToken } from '../../../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';
import TrailerTemplate, { ZonePhoto, PhotoPosition } from '../../../components/TrailerTemplate';
import PhotoLightbox from '../../../components/PhotoLightbox';
import { useAuthStore } from '../../../stores/auth';

const POSITION_LABELS: Record<PhotoPosition, string> = {
  'front': 'photos.front',
  'rear': 'photos.rear',
  'left-side': 'photos.leftSide',
  'right-side': 'photos.rightSide',
  'top': 'photos.top',
  'interior': 'photos.interior',
  'front-left': 'photos.frontLeft',
  'front-right': 'photos.frontRight',
  'rear-left': 'photos.rearLeft',
  'rear-right': 'photos.rearRight',
};

export default function HandoverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const [handover, setHandover] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<{ uri: string; label?: string; description?: string } | null>(null);

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

  const confirmDelete = () => {
    if (deleting) return;
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(
        'Ta operacja usunie przekazanie wraz ze zdjęciami i ewentualnym zwrotem. Czy kontynuować?'
      );
      if (confirmed) handleDelete();
    } else {
      Alert.alert(
        'Usuń przekazanie',
        'Ta operacja usunie przekazanie wraz ze zdjęciami i ewentualnym zwrotem. Czy kontynuować?',
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.delete'), style: 'destructive', onPress: handleDelete },
        ]
      );
    }
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await api.delete(`/handovers/${id}`);
      if (Platform.OS === 'web') {
        window.alert('Przekazanie usunięte');
      } else {
        Alert.alert(t('common.success'), 'Przekazanie usunięte');
      }
      router.replace('/(app)/handover');
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Nie udało się usunąć przekazania';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert(t('common.error'), msg);
      }
    } finally {
      setDeleting(false);
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
  const photoCount = Object.keys(photos).length;

  const ret = handover.return;
  const returnPhotos: Record<string, ZonePhoto | undefined> = {};
  for (const photo of ret?.photos || []) {
    returnPhotos[photo.position_on_template] = {
      uri: getUploadsUrl(photo.file_path),
      position: photo.position_on_template,
      description: photo.description,
      hasIssue: !!photo.has_issue,
      issueDescription: photo.issue_description,
    };
  }

  // All positions that appear in either handover or return photos
  const comparisonPositions = Array.from(
    new Set([
      ...Object.keys(photos),
      ...Object.keys(returnPhotos),
    ])
  ) as PhotoPosition[];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerId}>#{handover.id}</Text>
        <View style={styles.headerRight}>
          <View style={[
            styles.badge,
            handover.status === 'active' ? styles.badgeActive : styles.badgeReturned,
          ]}>
            <Text style={styles.badgeText}>
              {handover.status === 'active' ? t('handover.active') : t('handover.returned')}
            </Text>
          </View>
          {user?.role === 'admin' && (
            <TouchableOpacity
              style={styles.deleteIconBtn}
              onPress={confirmDelete}
              disabled={deleting}
            >
              {deleting ? (
                <ActivityIndicator size={16} color={Colors.danger} />
              ) : (
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              )}
            </TouchableOpacity>
          )}
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
        {handover.production_date ? <Text style={styles.detail}>{t('trailer.productionDate')}: {handover.production_date}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('handover.date')}</Text>
        <Text style={styles.value}>{handover.handover_date} {handover.handover_time}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('handover.documents')}</Text>
        <Text style={styles.value}>{handover.has_documents ? t('common.yes') : t('common.no')}</Text>
        <Text style={styles.detail}>{t('handover.beams')}: {handover.beams_count ?? 0} {t('handover.pcs')}</Text>
        <Text style={styles.detail}>{t('handover.straps')}: {handover.straps_count ?? 0} {t('handover.pcs')}</Text>
      </View>

      {handover.equipment_notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('handover.equipment')}</Text>
          <Text style={styles.detail}>{handover.equipment_notes}</Text>
        </View>
      ) : null}

      {/* Return info (when returned) */}
      {ret && (
        <View style={[styles.section, styles.returnSection]}>
          <View style={styles.returnHeader}>
            <Ionicons name="return-down-back" size={16} color={Colors.primary} />
            <Text style={[styles.sectionTitle, { marginBottom: 0, color: Colors.primary }]}>
              Zwrot
            </Text>
          </View>
          <Text style={styles.value}>{ret.return_date} {ret.return_time}</Text>
          {ret.notes ? <Text style={styles.detail}>{ret.notes}</Text> : null}
          {ret.created_by_name ? (
            <Text style={styles.detail}>Przyjął: {ret.created_by_name}</Text>
          ) : null}
        </View>
      )}

      {/* Photo comparison when returned */}
      {ret && comparisonPositions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Porównanie zdjęć</Text>
          <View style={styles.compLegend}>
            <Text style={styles.compLegendItem}>Przekazanie</Text>
            <Text style={styles.compLegendItem}>Zwrot</Text>
          </View>
          {comparisonPositions.map((pos) => {
            const orig = photos[pos];
            const ret_photo = returnPhotos[pos];
            return (
              <View key={pos} style={styles.compCard}>
                <Text style={styles.compPosLabel}>{t(POSITION_LABELS[pos])}</Text>
                <View style={styles.compRow}>
                  {/* Original */}
                  <View style={styles.compCol}>
                    {orig ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => setLightboxPhoto({ uri: orig.uri, label: t(POSITION_LABELS[pos]), description: orig.description })}
                      >
                        <Image source={{ uri: orig.uri }} style={styles.compImg} />
                        <View style={styles.expandBadge}>
                          <Ionicons name="expand-outline" size={12} color={Colors.white} />
                        </View>
                        {orig.description ? (
                          <Text style={styles.compImgDesc}>{orig.description}</Text>
                        ) : null}
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.compImgEmpty}>
                        <Text style={styles.compImgEmptyText}>—</Text>
                      </View>
                    )}
                  </View>
                  {/* Arrow */}
                  <View style={styles.compArrow}>
                    <Ionicons name="arrow-forward" size={16} color={Colors.gray400} />
                  </View>
                  {/* Return photo */}
                  <View style={styles.compCol}>
                    {ret_photo ? (
                      <TouchableOpacity
                        activeOpacity={0.85}
                        style={ret_photo.hasIssue ? styles.issueImgContainer : undefined}
                        onPress={() => setLightboxPhoto({ uri: ret_photo.uri, label: t(POSITION_LABELS[pos]), description: ret_photo.issueDescription || ret_photo.description })}
                      >
                        <Image source={{ uri: ret_photo.uri }} style={styles.compImg} />
                        <View style={styles.expandBadge}>
                          <Ionicons name="expand-outline" size={12} color={Colors.white} />
                        </View>
                        {ret_photo.hasIssue && (
                          <View style={styles.issueBadge}>
                            <Text style={styles.issueBadgeText}>!</Text>
                          </View>
                        )}
                        {ret_photo.issueDescription ? (
                          <Text style={styles.issueDesc}>{ret_photo.issueDescription}</Text>
                        ) : ret_photo.description ? (
                          <Text style={styles.compImgDesc}>{ret_photo.description}</Text>
                        ) : null}
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.compImgEmpty}>
                        <Text style={styles.compImgEmptyText}>—</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Handover photos (only show standalone template when NOT returned — comparison above covers it) */}
      {!ret && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('handover.photos')}</Text>
          <Text style={styles.photosMeta}>Zapisane zdjęcia: {photoCount}</Text>
          <TrailerTemplate
            photos={photos}
            onZonePress={() => {}}
            onPhotoPress={(photo) => setLightboxPhoto({ uri: photo.uri, label: photo.position, description: photo.description })}
            readOnly
          />
          {photoCount === 0 && (
            <Text style={styles.emptyPhotosText}>Brak zdjęć w tym przekazaniu.</Text>
          )}
        </View>
      )}

      {/* PDFs */}
      <TouchableOpacity style={styles.pdfBtn} onPress={generatePdf}>
        <Ionicons name="document-outline" size={20} color={Colors.primary} />
        <Text style={styles.pdfBtnText}>{t('handover.generatePdf')}</Text>
      </TouchableOpacity>

      <PhotoLightbox
        uri={lightboxPhoto?.uri ?? null}
        label={lightboxPhoto?.label}
        description={lightboxPhoto?.description}
        onClose={() => setLightboxPhoto(null)}
      />

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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
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
  returnSection: {
    borderColor: Colors.primary,
    borderLeftWidth: 3,
  },
  returnHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.sm,
  },
  value: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  detail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  photosMeta: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  emptyPhotosText: {
    marginTop: Spacing.sm,
    fontSize: FontSize.sm,
    color: Colors.gray500,
    fontStyle: 'italic',
  },
  // Comparison styles
  compLegend: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  compLegendItem: {
    flex: 1,
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  compCard: {
    marginBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.sm,
  },
  compPosLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compCol: { flex: 1, position: 'relative' },
  compArrow: {
    width: 24,
    alignItems: 'center',
  },
  compImg: {
    width: '100%',
    height: 130,
    borderRadius: BorderRadius.sm,
    resizeMode: 'cover',
  },
  compImgDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  compImgEmpty: {
    height: 130,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  compImgEmptyText: { color: Colors.gray400, fontSize: FontSize.lg },
  issueImgContainer: {
    borderWidth: 2,
    borderColor: Colors.danger,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
  },
  issueBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  issueBadgeText: { color: Colors.white, fontSize: 11, fontWeight: '700' },
  issueDesc: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    fontWeight: '600',
    marginTop: 2,
  },
  expandBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  pdfBtnText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
  deleteIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
