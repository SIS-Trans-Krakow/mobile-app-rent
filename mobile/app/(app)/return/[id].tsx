import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, Platform, Linking, Image, Switch,
} from 'react-native';
import { KeyboardAwareScrollView } from '../../../utils/keyboardController';

const ScrollContainer: React.ComponentType<any> = KeyboardAwareScrollView;
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import api, { getUploadsUrl, getAccessToken } from '../../../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';
import TrailerTemplate, { PhotoPosition, ZonePhoto, ALL_POSITIONS } from '../../../components/TrailerTemplate';
import PhotoCapture from '../../../components/PhotoCapture';
import PhotoLightbox from '../../../components/PhotoLightbox';
import ClientSignatureField from '../../../components/ClientSignatureField';
import { calculateRentalFullDays } from '../../../utils/rentalDuration';

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

export default function ReturnScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  const [handover, setHandover] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnTime, setReturnTime] = useState(
    new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  );
  const [notes, setNotes] = useState('');

  const [returnHasDocuments, setReturnHasDocuments] = useState(false);
  const [returnBeamsCount, setReturnBeamsCount] = useState('');
  const [returnStrapsCount, setReturnStrapsCount] = useState('');

  const [returnPhotos, setReturnPhotos] = useState<Record<string, ZonePhoto | undefined>>({});
  const [capturePosition, setCapturePosition] = useState<PhotoPosition | null>(null);

  const [originalPhotos, setOriginalPhotos] = useState<Record<string, ZonePhoto | undefined>>({});
  const [lightboxPhoto, setLightboxPhoto] = useState<{ uri: string; label?: string; description?: string } | null>(null);
  const [clientSignature, setClientSignature] = useState<string | null>(null);

  useEffect(() => {
    loadHandover();
  }, [id]);

  const loadHandover = async () => {
    try {
      const res = await api.get(`/handovers/${id}`);
      setHandover(res.data);

      const oPhotos: Record<string, ZonePhoto | undefined> = {};
      for (const photo of res.data.photos || []) {
        oPhotos[photo.position_on_template] = {
          uri: getUploadsUrl(photo.file_path),
          position: photo.position_on_template,
          description: photo.description,
          hasIssue: !!photo.has_issue,
          issueDescription: photo.issue_description || '',
        };
      }
      setOriginalPhotos(oPhotos);
    } catch (err) {
      console.error('Load handover error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleZonePress = (position: PhotoPosition) => {
    setCapturePosition(position);
  };

  const handlePhotoSave = (photo: ZonePhoto) => {
    setReturnPhotos((prev) => ({ ...prev, [photo.position]: photo }));
  };

  const handleSubmit = async () => {
    if (submitting) return;

    const requiredPositions = ALL_POSITIONS.filter((pos) => !!originalPhotos[pos]);
    const missingPositions = requiredPositions.filter((pos) => !returnPhotos[pos]);
    if (missingPositions.length > 0) {
      const missingLabels = missingPositions.map((pos) => t(POSITION_LABELS[pos])).join(', ');
      Alert.alert(
        t('common.error'),
        t('return.missingPhotosForPositions', { positions: missingLabels })
      );
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('handover_id', id!);
      formData.append('return_date', returnDate);
      formData.append('return_time', returnTime);
      formData.append('notes', notes);
      formData.append('return_has_documents', returnHasDocuments ? '1' : '0');
      formData.append('return_beams_count', returnBeamsCount || '0');
      formData.append('return_straps_count', returnStrapsCount || '0');
      if (clientSignature) {
        formData.append('client_signature_base64', clientSignature);
      }

      const photoEntries = Object.values(returnPhotos).filter(Boolean) as ZonePhoto[];
      for (const photo of photoEntries) {
        const filename = photo.uri.split('/').pop() || 'photo.jpg';
        if (Platform.OS === 'web') {
          const response = await fetch(photo.uri);
          const blob = await response.blob();
          const file = new File([blob], filename, { type: blob.type || 'image/jpeg' });
          formData.append('photos', file);
        } else {
          formData.append('photos', { uri: photo.uri, name: filename, type: 'image/jpeg' } as any);
        }
        formData.append('photo_positions', photo.position);
        formData.append('photo_descriptions', photo.description || '');
        formData.append('photo_has_issues', photo.hasIssue ? '1' : '0');
        formData.append('photo_issue_descriptions', photo.issueDescription || '');
        formData.append('photo_new_issue_descriptions', photo.newIssueDescription || '');
      }

      const res = await api.post('/returns', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (Platform.OS === 'web') {
        const baseUrl = api.defaults.baseURL?.replace('/api', '');
        const token = getAccessToken();
        const reportUrl = `${baseUrl}/api/pdf/return/${res.data.id}?token=${token}`;
        const generateReport = window.confirm(
          `${t('return.created')}\n\n${t('return.generateReport')}?`
        );
        if (generateReport) window.open(reportUrl, '_blank');
        router.back();
      } else {
        Alert.alert(t('common.success'), t('return.created'), [
          {
            text: t('return.generateReport'),
            onPress: () => {
              const baseUrl = api.defaults.baseURL?.replace('/api', '');
              const token = getAccessToken();
              const url = `${baseUrl}/api/pdf/return/${res.data.id}?token=${token}`;
              Linking.openURL(url);
              router.back();
            },
          },
          { text: t('common.ok'), onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || t('common.error');
      if (Platform.OS === 'web') {
        window.alert(errMsg);
      } else {
        Alert.alert(t('common.error'), errMsg);
      }
    } finally {
      setSubmitting(false);
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

  const hasIssues = Object.values(returnPhotos).some((p) => p?.hasIssue);
  const handoverIssueCount = Object.values(originalPhotos).filter((p) => p?.hasIssue).length;
  const requiredPositions = ALL_POSITIONS.filter((pos) => !!originalPhotos[pos]);
  const missingRequiredPositions = requiredPositions.filter((pos) => !returnPhotos[pos]);

  const submitAccessibilityLabel =
    missingRequiredPositions.length > 0
      ? t('return.fillMissingPhotos')
      : t('return.submitReturn');

  return (
    <ScrollContainer style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bottomOffset={Spacing.lg}>
      {/* Handover summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>{handover.company_name}</Text>
        <Text style={styles.summaryDetail}>
          {handover.registration_number} ({handover.trailer_type})
        </Text>
        <Text style={styles.summaryDetail}>
          {t('handover.date')}: {handover.handover_date} {handover.handover_time}
        </Text>
      </View>

      {/* Return date/time */}
      <View style={styles.section}>
        <Text style={styles.label}>{t('return.date')}</Text>
        <TextInput style={styles.input} value={returnDate} onChangeText={setReturnDate}
          placeholder="YYYY-MM-DD" placeholderTextColor={Colors.gray400} />

        <Text style={styles.label}>{t('return.time')}</Text>
        <TextInput style={styles.input} value={returnTime} onChangeText={setReturnTime}
          placeholder="HH:MM" placeholderTextColor={Colors.gray400} />

        {(() => {
          const days = calculateRentalFullDays(
            handover?.handover_date,
            handover?.handover_time,
            returnDate,
            returnTime,
          );
          return (
            <View style={styles.rentalDurationBox}>
              <Ionicons name="time-outline" size={14} color={Colors.primary} />
              <Text style={styles.rentalDurationText}>
                {t('return.rentalDuration')}:{' '}
                {days !== null
                  ? t('return.rentalDurationDays', { count: days })
                  : t('return.rentalDurationUnparseable')}
              </Text>
            </View>
          );
        })()}

        <Text style={styles.label}>{t('return.notes')}</Text>
        <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes}
          placeholder={t('return.notes')} placeholderTextColor={Colors.gray400}
          multiline numberOfLines={3} />
      </View>

      {/* Equipment check */}
      <View style={styles.section}>
        <Text style={styles.equipSectionTitle}>
          {t('return.documents')} / {t('return.beams')} / {t('return.straps')}
        </Text>
        {handover.has_documents !== undefined && (
          <Text style={styles.equipHint}>
            {t('handover.documents')}: {handover.has_documents ? t('common.yes') : t('common.no')} |{' '}
            {t('handover.beams')}: {handover.beams_count ?? 0} {t('handover.pcs')} |{' '}
            {t('handover.straps')}: {handover.straps_count ?? 0} {t('handover.pcs')}
          </Text>
        )}

        <Text style={styles.label}>{t('return.returnDocuments')}</Text>
        <View style={styles.switchRow}>
          <Switch
            value={returnHasDocuments}
            onValueChange={setReturnHasDocuments}
            trackColor={{ false: Colors.gray200, true: Colors.primary }}
            thumbColor={Colors.white}
          />
          <Text style={styles.switchLabel}>
            {returnHasDocuments ? t('common.yes') : t('common.no')}
          </Text>
        </View>

        <Text style={styles.label}>{t('return.returnBeams')}</Text>
        <TextInput
          style={styles.input}
          value={returnBeamsCount}
          onChangeText={setReturnBeamsCount}
          placeholder="0"
          placeholderTextColor={Colors.gray400}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>{t('return.returnStraps')}</Text>
        <TextInput
          style={styles.input}
          value={returnStrapsCount}
          onChangeText={setReturnStrapsCount}
          placeholder="0"
          placeholderTextColor={Colors.gray400}
          keyboardType="number-pad"
        />
      </View>

      {/* Comparison: original photos + new photos */}
      {handoverIssueCount > 0 && (
        <View style={styles.handoverIssueBanner}>
          <Ionicons name="warning" size={16} color={Colors.danger} />
          <Text style={styles.handoverIssueBannerText}>
            {t('return.handoverIssueBanner', { count: handoverIssueCount })}
          </Text>
        </View>
      )}
      <Text style={styles.sectionTitle}>{t('return.comparison')}</Text>
      {requiredPositions.length > 0 && (
        <Text style={styles.requiredHint}>
          {t('return.requiredPhotosProgress', {
            required: requiredPositions.length,
            added: requiredPositions.length - missingRequiredPositions.length,
          })}
        </Text>
      )}
      {missingRequiredPositions.length > 0 && (
        <View style={styles.validationBox}>
          <Text style={styles.validationTitle}>{t('return.missingPhotosTitle')}</Text>
          <Text style={styles.validationText}>
            {missingRequiredPositions.map((pos) => t(POSITION_LABELS[pos])).join(', ')}
          </Text>
        </View>
      )}

      {ALL_POSITIONS.filter(pos => originalPhotos[pos]).map((pos) => {
        const original = originalPhotos[pos];
        const returnPhoto = returnPhotos[pos];

        return (
          <View key={pos} style={styles.comparisonCard}>
            <Text style={styles.posLabel}>{t(POSITION_LABELS[pos])}</Text>
            <View style={styles.comparisonRow}>
              <View style={styles.comparisonCol}>
                <Text style={styles.colLabel}>{t('return.original')}</Text>
                {original ? (
                  <TouchableOpacity
                    onPress={() => setLightboxPhoto({
                      uri: original.uri,
                      label: t(POSITION_LABELS[pos]),
                      description: original.hasIssue ? original.issueDescription : original.description,
                    })}
                    activeOpacity={0.85}
                    style={original.hasIssue ? styles.issueContainer : undefined}
                    accessibilityRole="button"
                    accessible
                    accessibilityLabel={`${t('return.original')}: ${t(POSITION_LABELS[pos])}`}
                  >
                    <Image source={{ uri: original.uri }} style={styles.comparisonImg} />
                    <View style={styles.expandBadge}>
                      <Ionicons name="expand-outline" size={12} color={Colors.white} />
                    </View>
                    {original.hasIssue && (
                      <View style={styles.origIssueBadge}>
                        <Text style={styles.origIssueBadgeText}>!</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                ) : (
                  <View style={styles.noPhoto}>
                    <Text style={styles.noPhotoText}>-</Text>
                  </View>
                )}
                {original?.hasIssue && original.issueDescription ? (
                  <Text style={styles.issueText}>{original.issueDescription}</Text>
                ) : original?.description ? (
                  <Text style={styles.compDesc}>{original.description}</Text>
                ) : original ? (
                  <Text style={styles.noIssueText}>{t('return.noIssues')}</Text>
                ) : null}
              </View>

              <View style={styles.comparisonCol}>
                <Text style={styles.colLabel}>{t('return.current')}</Text>
                <TouchableOpacity
                  style={[
                    styles.comparisonImgContainer,
                    returnPhoto?.hasIssue && styles.issueContainer,
                  ]}
                  onPress={() => {
                    if (returnPhoto) {
                      setLightboxPhoto({
                        uri: returnPhoto.uri,
                        label: t(POSITION_LABELS[pos]),
                        description: returnPhoto.hasIssue ? returnPhoto.issueDescription : returnPhoto.description,
                      });
                    } else {
                      handleZonePress(pos);
                    }
                  }}
                  onLongPress={() => handleZonePress(pos)}
                  accessibilityRole="button"
                  accessible
                  accessibilityLabel={
                    returnPhoto
                      ? `${t('return.current')}: ${t(POSITION_LABELS[pos])}`
                      : `${t('photos.takePhoto')}, ${t(POSITION_LABELS[pos])}`
                  }
                >
                  {returnPhoto ? (
                    <>
                      <Image source={{ uri: returnPhoto.uri }} style={styles.comparisonImg} />
                      <View style={styles.expandBadge}>
                        <Ionicons name="expand-outline" size={12} color={Colors.white} />
                      </View>
                      {returnPhoto.hasIssue && (
                        <View style={styles.origIssueBadge}>
                          <Text style={styles.origIssueBadgeText}>!</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.addPhotoBtn}>
                      <Ionicons name="camera" size={24} color={Colors.primary} />
                      <Text style={styles.addPhotoText}>{t('photos.takePhoto')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {returnPhoto && (
                  <TouchableOpacity
                    onPress={() => handleZonePress(pos)}
                    style={styles.editPhotoLink}
                    accessibilityRole="button"
                    accessible
                    accessibilityLabel={t('return.changePhoto')}
                  >
                    <Ionicons name="pencil-outline" size={12} color={Colors.primary} />
                    <Text style={styles.editPhotoText}>{t('return.changePhoto')}</Text>
                  </TouchableOpacity>
                )}
                {returnPhoto?.hasIssue && returnPhoto.issueDescription ? (
                  original?.hasIssue ? (
                    returnPhoto.hasNewIssue && returnPhoto.newIssueDescription ? (
                      <Text style={styles.issueText}>{returnPhoto.newIssueDescription}</Text>
                    ) : (
                      <Text style={styles.noIssueText}>{t('return.noNewIssues')}</Text>
                    )
                  ) : (
                    <Text style={styles.issueText}>{returnPhoto.issueDescription}</Text>
                  )
                ) : returnPhoto?.description ? (
                  <Text style={styles.compDesc}>{returnPhoto.description}</Text>
                ) : returnPhoto ? (
                  <Text style={styles.noIssueText}>{t('return.noIssues')}</Text>
                ) : null}
              </View>
            </View>
          </View>
        );
      })}

      {/* Also allow photos for positions not in original */}
      <Text style={styles.sectionTitle}>{t('handover.addPhotos')}</Text>
      <TrailerTemplate
        photos={returnPhotos}
        onZonePress={handleZonePress}
      />

      <View style={{ marginTop: Spacing.md }}>
        <ClientSignatureField
          signatureBase64={clientSignature}
          onChange={setClientSignature}
        />
      </View>

      {/* Submit */}
      <TouchableOpacity
        style={[
          styles.submitBtn,
          hasIssues && { backgroundColor: Colors.warning },
          missingRequiredPositions.length > 0 && styles.submitBtnDisabled,
        ]}
        onPress={handleSubmit}
        disabled={submitting || missingRequiredPositions.length > 0}
        accessibilityRole="button"
        accessible
        accessibilityLabel={submitAccessibilityLabel}
        accessibilityState={{
          disabled: submitting || missingRequiredPositions.length > 0,
        }}
      >
        {submitting ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={22} color={Colors.white} />
            <Text style={styles.submitText}>
              {missingRequiredPositions.length > 0
                ? t('return.fillMissingPhotos')
                : t('return.submitReturn')}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {capturePosition && (
        <PhotoCapture
          position={capturePosition}
          visible={!!capturePosition}
          onClose={() => setCapturePosition(null)}
          onSave={handlePhotoSave}
          onDelete={() => {
            setReturnPhotos((prev) => {
              const next = { ...prev };
              delete next[capturePosition];
              return next;
            });
            setCapturePosition(null);
          }}
          existingPhoto={returnPhotos[capturePosition]}
          showIssueFields
          originalPhoto={originalPhotos[capturePosition]}
        />
      )}

      <PhotoLightbox
        uri={lightboxPhoto?.uri ?? null}
        label={lightboxPhoto?.label}
        description={lightboxPhoto?.description}
        onClose={() => setLightboxPhoto(null)}
      />
    </ScrollContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summary: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  summaryTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.white },
  summaryDetail: { fontSize: FontSize.sm, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  section: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gray700,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
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
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  switchLabel: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '500',
  },
  equipSectionTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  equipHint: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  rentalDurationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
  },
  rentalDurationText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  comparisonCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  posLabel: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text, marginBottom: Spacing.sm },
  comparisonRow: { flexDirection: 'row', gap: Spacing.sm },
  comparisonCol: { flex: 1 },
  colLabel: { fontSize: FontSize.xs, fontWeight: '600', color: Colors.textSecondary, marginBottom: Spacing.xs },
  comparisonImg: {
    width: '100%',
    height: 120,
    borderRadius: BorderRadius.sm,
    resizeMode: 'cover',
  },
  comparisonImgContainer: {
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    position: 'relative',
  },
  issueContainer: {
    borderWidth: 2,
    borderColor: Colors.danger,
  },
  noPhoto: {
    height: 120,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.gray100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noPhotoText: { color: Colors.gray400 },
  addPhotoBtn: {
    height: 120,
    borderRadius: BorderRadius.sm,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
  },
  addPhotoText: { fontSize: FontSize.xs, color: Colors.primary, marginTop: 4 },
  compDesc: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: Spacing.xs },
  noIssueText: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  issueText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    fontWeight: '600',
    marginTop: Spacing.xs,
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
  editPhotoLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: Spacing.xs,
  },
  editPhotoText: {
    fontSize: FontSize.xs,
    color: Colors.primary,
    fontWeight: '600',
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.success,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  submitText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '700' },
  submitBtnDisabled: {
    backgroundColor: Colors.gray400,
  },
  requiredHint: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  validationBox: {
    backgroundColor: '#fff7ed',
    borderWidth: 1,
    borderColor: '#fdba74',
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  validationTitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: '#9a3412',
  },
  validationText: {
    fontSize: FontSize.sm,
    color: '#9a3412',
    marginTop: 2,
  },
  origIssueBadge: {
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
  origIssueBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  handoverIssueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    backgroundColor: '#fef2f2',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.danger,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  handoverIssueBannerText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.danger,
    fontWeight: '600',
    lineHeight: 16,
  },
});
