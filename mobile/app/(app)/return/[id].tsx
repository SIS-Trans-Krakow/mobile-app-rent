import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, StyleSheet, ActivityIndicator,
  TouchableOpacity, Alert, Platform, Linking, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import api, { getUploadsUrl, getAccessToken } from '../../../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';
import TrailerTemplate, { PhotoPosition, ZonePhoto, ALL_POSITIONS } from '../../../components/TrailerTemplate';
import PhotoCapture from '../../../components/PhotoCapture';

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

  const [returnPhotos, setReturnPhotos] = useState<Record<string, ZonePhoto | undefined>>({});
  const [capturePosition, setCapturePosition] = useState<PhotoPosition | null>(null);

  const [originalPhotos, setOriginalPhotos] = useState<Record<string, ZonePhoto | undefined>>({});

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
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('handover_id', id!);
      formData.append('return_date', returnDate);
      formData.append('return_time', returnTime);
      formData.append('notes', notes);

      const photoEntries = Object.values(returnPhotos).filter(Boolean) as ZonePhoto[];
      for (const photo of photoEntries) {
        const filename = photo.uri.split('/').pop() || 'photo.jpg';
        formData.append('photos', {
          uri: photo.uri,
          name: filename,
          type: 'image/jpeg',
        } as any);
        formData.append('photo_positions', photo.position);
        formData.append('photo_descriptions', photo.description || '');
        formData.append('photo_has_issues', photo.hasIssue ? '1' : '0');
        formData.append('photo_issue_descriptions', photo.issueDescription || '');
      }

      const res = await api.post('/returns', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert(t('common.success'), t('return.created'), [
        {
          text: t('return.generateReport'),
          onPress: () => {
            const baseUrl = api.defaults.baseURL?.replace('/api', '');
            const token = getAccessToken();
            const url = `${baseUrl}/api/pdf/return/${res.data.id}?token=${token}`;
            if (Platform.OS === 'web') {
              window.open(url, '_blank');
            } else {
              Linking.openURL(url);
            }
            router.back();
          },
        },
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.error || 'Error');
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
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

        <Text style={styles.label}>{t('return.notes')}</Text>
        <TextInput style={[styles.input, styles.textArea]} value={notes} onChangeText={setNotes}
          placeholder={t('return.notes')} placeholderTextColor={Colors.gray400}
          multiline numberOfLines={3} />
      </View>

      {/* Comparison: original photos + new photos */}
      <Text style={styles.sectionTitle}>{t('return.comparison')}</Text>

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
                  <Image source={{ uri: original.uri }} style={styles.comparisonImg} />
                ) : (
                  <View style={styles.noPhoto}>
                    <Text style={styles.noPhotoText}>-</Text>
                  </View>
                )}
                {original?.description ? (
                  <Text style={styles.compDesc}>{original.description}</Text>
                ) : null}
              </View>

              <View style={styles.comparisonCol}>
                <Text style={styles.colLabel}>{t('return.current')}</Text>
                <TouchableOpacity
                  style={[
                    styles.comparisonImgContainer,
                    returnPhoto?.hasIssue && styles.issueContainer,
                  ]}
                  onPress={() => handleZonePress(pos)}
                >
                  {returnPhoto ? (
                    <Image source={{ uri: returnPhoto.uri }} style={styles.comparisonImg} />
                  ) : (
                    <View style={styles.addPhotoBtn}>
                      <Ionicons name="camera" size={24} color={Colors.primary} />
                      <Text style={styles.addPhotoText}>{t('photos.takePhoto')}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {returnPhoto?.hasIssue && (
                  <Text style={styles.issueText}>{returnPhoto.issueDescription}</Text>
                )}
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

      {/* Submit */}
      <TouchableOpacity
        style={[styles.submitBtn, hasIssues && { backgroundColor: Colors.warning }]}
        onPress={handleSubmit}
        disabled={submitting}
      >
        {submitting ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={22} color={Colors.white} />
            <Text style={styles.submitText}>
              {hasIssues ? t('return.generateReport') : t('common.submit')}
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
          existingPhoto={returnPhotos[capturePosition]}
          showIssueFields
          originalPhoto={originalPhotos[capturePosition]}
        />
      )}
    </ScrollView>
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
  issueText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    fontWeight: '600',
    marginTop: Spacing.xs,
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
});
