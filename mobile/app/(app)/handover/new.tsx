import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';
import TrailerTemplate, { PhotoPosition, ZonePhoto } from '../../../components/TrailerTemplate';
import PhotoCapture from '../../../components/PhotoCapture';

const TRAILER_TYPES = ['Kurtyna', 'Box', 'Izoterma', 'Chłodnia'] as const;

export default function NewHandoverScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Company fields
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');
  const [companyContact, setCompanyContact] = useState('');

  // Trailer fields
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vin, setVin] = useState('');
  const [brand, setBrand] = useState('');
  const [trailerType, setTrailerType] = useState<string>(TRAILER_TYPES[0]);

  // Handover fields
  const [handoverDate, setHandoverDate] = useState(new Date().toISOString().split('T')[0]);
  const [handoverTime, setHandoverTime] = useState(
    new Date().toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
  );
  const [equipmentNotes, setEquipmentNotes] = useState('');

  // Photos
  const [photos, setPhotos] = useState<Record<string, ZonePhoto | undefined>>({});
  const [capturePosition, setCapturePosition] = useState<PhotoPosition | null>(null);

  const handleZonePress = (position: PhotoPosition) => {
    setCapturePosition(position);
  };

  const handlePhotoSave = (photo: ZonePhoto) => {
    setPhotos((prev) => ({ ...prev, [photo.position]: photo }));
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!companyName.trim()) {
        Alert.alert(t('common.error'), t('common.required'));
        return false;
      }
    } else if (step === 1) {
      if (!registrationNumber.trim()) {
        Alert.alert(t('common.error'), t('common.required'));
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) setStep(step + 1);
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('company_name', companyName);
      formData.append('company_address', companyAddress);
      formData.append('company_phone', companyPhone);
      formData.append('company_email', companyEmail);
      formData.append('company_contact', companyContact);
      formData.append('registration_number', registrationNumber);
      formData.append('vin', vin);
      formData.append('brand', brand);
      formData.append('trailer_type', trailerType);
      formData.append('handover_date', handoverDate);
      formData.append('handover_time', handoverTime);
      formData.append('equipment_notes', equipmentNotes);

      const photoEntries = Object.values(photos).filter(Boolean) as ZonePhoto[];
      for (const photo of photoEntries) {
        const filename = photo.uri.split('/').pop() || 'photo.jpg';
        formData.append('photos', {
          uri: photo.uri,
          name: filename,
          type: 'image/jpeg',
        } as any);
        formData.append('photo_positions', photo.position);
        formData.append('photo_descriptions', photo.description || '');
      }

      await api.post('/handovers', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      Alert.alert(t('common.success'), t('handover.created'), [
        { text: t('common.ok'), onPress: () => router.back() },
      ]);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.response?.data?.error || 'Error');
    } finally {
      setLoading(false);
    }
  };

  const renderCompanyStep = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionTitle}>{t('handover.company')}</Text>

      <Text style={styles.label}>{t('handover.companyName')} *</Text>
      <TextInput style={styles.input} value={companyName} onChangeText={setCompanyName}
        placeholder={t('handover.companyName')} placeholderTextColor={Colors.gray400} />

      <Text style={styles.label}>{t('handover.companyAddress')}</Text>
      <TextInput style={styles.input} value={companyAddress} onChangeText={setCompanyAddress}
        placeholder={t('handover.companyAddress')} placeholderTextColor={Colors.gray400} />

      <Text style={styles.label}>{t('handover.companyPhone')}</Text>
      <TextInput style={styles.input} value={companyPhone} onChangeText={setCompanyPhone}
        placeholder={t('handover.companyPhone')} placeholderTextColor={Colors.gray400}
        keyboardType="phone-pad" />

      <Text style={styles.label}>{t('handover.companyEmail')}</Text>
      <TextInput style={styles.input} value={companyEmail} onChangeText={setCompanyEmail}
        placeholder={t('handover.companyEmail')} placeholderTextColor={Colors.gray400}
        keyboardType="email-address" autoCapitalize="none" />

      <Text style={styles.label}>{t('handover.companyContact')}</Text>
      <TextInput style={styles.input} value={companyContact} onChangeText={setCompanyContact}
        placeholder={t('handover.companyContact')} placeholderTextColor={Colors.gray400} />
    </ScrollView>
  );

  const renderTrailerStep = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionTitle}>{t('handover.trailer')}</Text>

      <Text style={styles.label}>{t('handover.registrationNumber')} *</Text>
      <TextInput style={styles.input} value={registrationNumber} onChangeText={setRegistrationNumber}
        placeholder={t('handover.registrationNumber')} placeholderTextColor={Colors.gray400}
        autoCapitalize="characters" />

      <Text style={styles.label}>{t('handover.vin')}</Text>
      <TextInput style={styles.input} value={vin} onChangeText={setVin}
        placeholder={t('handover.vin')} placeholderTextColor={Colors.gray400}
        autoCapitalize="characters" />

      <Text style={styles.label}>{t('handover.brand')}</Text>
      <TextInput style={styles.input} value={brand} onChangeText={setBrand}
        placeholder={t('handover.brand')} placeholderTextColor={Colors.gray400} />

      <Text style={styles.label}>{t('handover.trailerType')} *</Text>
      <View style={styles.typeRow}>
        {TRAILER_TYPES.map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.typeChip, trailerType === type && styles.typeChipActive]}
            onPress={() => setTrailerType(type)}
          >
            <Text style={[styles.typeChipText, trailerType === type && styles.typeChipTextActive]}>
              {t(`trailer.types.${type}`)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>{t('handover.date')}</Text>
      <TextInput style={styles.input} value={handoverDate} onChangeText={setHandoverDate}
        placeholder="YYYY-MM-DD" placeholderTextColor={Colors.gray400} />

      <Text style={styles.label}>{t('handover.time')}</Text>
      <TextInput style={styles.input} value={handoverTime} onChangeText={setHandoverTime}
        placeholder="HH:MM" placeholderTextColor={Colors.gray400} />

      <Text style={styles.label}>{t('handover.equipment')}</Text>
      <TextInput style={[styles.input, styles.textArea]} value={equipmentNotes}
        onChangeText={setEquipmentNotes} placeholder={t('handover.equipmentNotes')}
        placeholderTextColor={Colors.gray400} multiline numberOfLines={4} />
    </ScrollView>
  );

  const renderPhotosStep = () => (
    <TrailerTemplate
      photos={photos}
      onZonePress={handleZonePress}
    />
  );

  const renderSummary = () => (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <Text style={styles.sectionTitle}>{t('handover.company')}</Text>
      <Text style={styles.summaryText}>{companyName}</Text>
      {companyAddress ? <Text style={styles.summaryDetail}>{companyAddress}</Text> : null}
      {companyContact ? <Text style={styles.summaryDetail}>{companyContact}</Text> : null}

      <Text style={styles.sectionTitle}>{t('handover.trailer')}</Text>
      <Text style={styles.summaryText}>{registrationNumber} - {t(`trailer.types.${trailerType}`)}</Text>
      {vin ? <Text style={styles.summaryDetail}>VIN: {vin}</Text> : null}
      {brand ? <Text style={styles.summaryDetail}>{brand}</Text> : null}

      <Text style={styles.sectionTitle}>{t('handover.date')}</Text>
      <Text style={styles.summaryText}>{handoverDate} {handoverTime}</Text>

      {equipmentNotes ? (
        <>
          <Text style={styles.sectionTitle}>{t('handover.equipment')}</Text>
          <Text style={styles.summaryText}>{equipmentNotes}</Text>
        </>
      ) : null}

      <Text style={styles.sectionTitle}>{t('handover.photos')}</Text>
      <Text style={styles.summaryDetail}>
        {Object.values(photos).filter(Boolean).length} {t('handover.photos').toLowerCase()}
      </Text>
    </ScrollView>
  );

  const steps = [renderCompanyStep, renderTrailerStep, renderPhotosStep, renderSummary];
  const stepLabels = [t('handover.company'), t('handover.trailer'), t('handover.photos'), 'Summary'];

  return (
    <View style={styles.container}>
      {/* Progress */}
      <View style={styles.progress}>
        {stepLabels.map((label, i) => (
          <View key={i} style={styles.progressItem}>
            <View style={[styles.progressDot, i <= step && styles.progressDotActive]}>
              <Text style={[styles.progressDotText, i <= step && styles.progressDotTextActive]}>
                {i + 1}
              </Text>
            </View>
            <Text style={[styles.progressLabel, i === step && styles.progressLabelActive]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      {/* Step content */}
      <View style={styles.content}>
        {steps[step]()}
      </View>

      {/* Navigation */}
      <View style={styles.nav}>
        {step > 0 && (
          <TouchableOpacity style={styles.navBtnSecondary} onPress={() => setStep(step - 1)}>
            <Text style={styles.navBtnSecondaryText}>{t('common.back')}</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {step < steps.length - 1 ? (
          <TouchableOpacity style={styles.navBtn} onPress={handleNext}>
            <Text style={styles.navBtnText}>{t('common.next')}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: Colors.success }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.navBtnText}>{t('common.submit')}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {capturePosition && (
        <PhotoCapture
          position={capturePosition}
          visible={!!capturePosition}
          onClose={() => setCapturePosition(null)}
          onSave={handlePhotoSave}
          existingPhoto={photos[capturePosition]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  scrollContent: { padding: Spacing.md },
  progress: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  progressItem: { alignItems: 'center' },
  progressDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.gray200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDotActive: { backgroundColor: Colors.primary },
  progressDotText: { fontSize: FontSize.xs, fontWeight: '700', color: Colors.gray500 },
  progressDotTextActive: { color: Colors.white },
  progressLabel: { fontSize: 10, color: Colors.gray400, marginTop: 2 },
  progressLabelActive: { color: Colors.primary, fontWeight: '600' },
  content: { flex: 1 },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
    marginTop: Spacing.md,
  },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gray700,
    marginBottom: Spacing.xs,
    marginTop: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  textArea: { minHeight: 100, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  typeChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.white,
  },
  typeChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  typeChipText: { fontSize: FontSize.sm, color: Colors.text },
  typeChipTextActive: { color: Colors.white, fontWeight: '600' },
  nav: {
    flexDirection: 'row',
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  navBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '600' },
  navBtnSecondary: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  navBtnSecondaryText: { color: Colors.textSecondary, fontSize: FontSize.md },
  summaryText: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600' },
  summaryDetail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
});
