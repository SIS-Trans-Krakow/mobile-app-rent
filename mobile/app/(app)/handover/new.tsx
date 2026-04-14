import { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView,
  Alert, ActivityIndicator, Platform, Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import api, { getUploadsUrl } from '../../../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';
import TrailerTemplate, { PhotoPosition, ZonePhoto } from '../../../components/TrailerTemplate';
import PhotoCapture from '../../../components/PhotoCapture';

const TRAILER_TYPES = ['Kurtyna', 'Box', 'Izoterma', 'Chłodnia', 'Kurtyna MEGA', 'TANDEM', 'Double Deck'] as const;

interface TrailerResult {
  id: number;
  registration_number: string;
  vin: string;
  brand: string;
  type: string;
  production_date: string;
}

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

  // Trailer search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TrailerResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedTrailer, setSelectedTrailer] = useState<TrailerResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const [hasDocuments, setHasDocuments] = useState(false);
  const [beamsCount, setBeamsCount] = useState('');
  const [strapsCount, setStrapsCount] = useState('');
  const [equipmentNotes, setEquipmentNotes] = useState('');

  // Photos
  const [photos, setPhotos] = useState<Record<string, ZonePhoto | undefined>>({});
  const [capturePosition, setCapturePosition] = useState<PhotoPosition | null>(null);
  const [lastReturnDate, setLastReturnDate] = useState<string | null>(null);

  const searchTrailers = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    setShowResults(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get('/trailers', { params: { search: query.trim() } });
        setSearchResults(res.data || []);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);
  }, []);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    if (selectedTrailer) {
      clearTrailerSelection();
    }
    searchTrailers(text);
  };

  const selectTrailer = async (trailer: TrailerResult) => {
    setSelectedTrailer(trailer);
    setSearchQuery(trailer.registration_number);
    setRegistrationNumber(trailer.registration_number);
    setVin(trailer.vin || '');
    setBrand(trailer.brand || '');
    if (TRAILER_TYPES.includes(trailer.type as any)) {
      setTrailerType(trailer.type);
    }
    setShowResults(false);
    setSearchResults([]);

    try {
      const res = await api.get(`/trailers/${trailer.id}/last-return-photos`);
      const returnPhotos: Array<{
        file_path: string;
        position_on_template: string;
        description: string;
        has_issue: number;
        issue_description: string;
      }> = res.data.photos || [];

      if (returnPhotos.length > 0) {
        const preloaded: Record<string, ZonePhoto> = {};
        for (const p of returnPhotos) {
          preloaded[p.position_on_template] = {
            uri: getUploadsUrl(p.file_path),
            position: p.position_on_template as PhotoPosition,
            description: p.description || '',
            hasIssue: !!p.has_issue,
            issueDescription: p.issue_description || '',
            isPreloaded: true,
            preloadedFilePath: p.file_path,
          };
        }
        setPhotos(preloaded);
        setLastReturnDate(res.data.return_date || null);
      } else {
        setPhotos({});
        setLastReturnDate(null);
      }
    } catch {
      setPhotos({});
      setLastReturnDate(null);
    }
  };

  const clearTrailerSelection = () => {
    setSelectedTrailer(null);
    setRegistrationNumber('');
    setVin('');
    setBrand('');
    setTrailerType(TRAILER_TYPES[0]);
    setSearchQuery('');
    setShowResults(false);
    setSearchResults([]);
    setPhotos({});
    setLastReturnDate(null);
  };

  const handleZonePress = (position: PhotoPosition) => {
    setCapturePosition(position);
  };

  const handlePhotoSave = (photo: ZonePhoto) => {
    setPhotos((prev) => ({
      ...prev,
      [photo.position]: { ...photo, isPreloaded: false, preloadedFilePath: undefined },
    }));
  };

  const validateStep = (): boolean => {
    if (step === 0) {
      if (!companyName.trim()) {
        Alert.alert(t('common.error'), t('common.required'));
        return false;
      }
    } else if (step === 1) {
      const regNum = selectedTrailer ? selectedTrailer.registration_number : registrationNumber;
      if (!regNum.trim()) {
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
    if (loading) return;
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('company_name', companyName);
      formData.append('company_address', companyAddress);
      formData.append('company_phone', companyPhone);
      formData.append('company_email', companyEmail);
      formData.append('company_contact', companyContact);
      if (selectedTrailer) {
        formData.append('trailer_id', String(selectedTrailer.id));
      }
      formData.append('registration_number', registrationNumber);
      formData.append('vin', vin);
      formData.append('brand', brand);
      formData.append('trailer_type', trailerType);
      formData.append('handover_date', handoverDate);
      formData.append('handover_time', handoverTime);
      formData.append('equipment_notes', equipmentNotes);
      formData.append('has_documents', hasDocuments ? '1' : '0');
      formData.append('beams_count', beamsCount || '0');
      formData.append('straps_count', strapsCount || '0');

      const photoEntries = Object.values(photos).filter(Boolean) as ZonePhoto[];
      for (const photo of photoEntries) {
        if (photo.isPreloaded && photo.preloadedFilePath) {
          formData.append('inherited_photo_filenames', photo.preloadedFilePath);
          formData.append('inherited_photo_positions', photo.position);
          formData.append('inherited_photo_descriptions', photo.description || '');
          formData.append('inherited_photo_has_issues', photo.hasIssue ? '1' : '0');
          formData.append('inherited_photo_issue_descriptions', photo.issueDescription || '');
        } else {
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
        }
      }

      const res = await api.post('/handovers', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const createdId = res?.data?.id;
      const target = createdId ? `/handover/${createdId}` : '/handover';

      if (Platform.OS === 'web') {
        window.alert(t('handover.created'));
        router.replace(target);
      } else {
        Alert.alert(t('common.success'), t('handover.created'), [
          { text: t('common.ok'), onPress: () => router.replace(target) },
        ]);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Error';
      if (Platform.OS === 'web') {
        window.alert(msg);
      } else {
        Alert.alert(t('common.error'), msg);
      }
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

  const renderTrailerStep = () => {
    const isFromDb = !!selectedTrailer;

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <Text style={styles.sectionTitle}>{t('handover.trailer')}</Text>

        <Text style={styles.label}>{t('handover.registrationNumber')} *</Text>
        <View style={styles.searchContainer}>
          <View style={styles.searchInputRow}>
            <Ionicons name="search" size={18} color={Colors.gray400} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearchChange}
              placeholder={t('handover.searchTrailerPlaceholder')}
              placeholderTextColor={Colors.gray400}
              autoCapitalize="characters"
            />
            {searchLoading && <ActivityIndicator size="small" color={Colors.primary} style={styles.searchSpinner} />}
            {isFromDb && (
              <TouchableOpacity
                onPress={clearTrailerSelection}
                style={styles.clearBtn}
                accessibilityRole="button"
                accessible
                accessibilityLabel={t('handover.clearSelection')}
              >
                <Ionicons name="close-circle" size={20} color={Colors.gray400} />
              </TouchableOpacity>
            )}
          </View>

          {showResults && !isFromDb && (
            <View style={styles.resultsDropdown}>
              <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled>
              {searchLoading ? (
                <View style={styles.resultItem}>
                  <Text style={styles.resultHint}>{t('handover.searching')}</Text>
                </View>
              ) : searchResults.length > 0 ? (
                <>
                  {searchResults.map((trailer) => (
                    <TouchableOpacity
                      key={trailer.id}
                      style={styles.resultItem}
                      onPress={() => selectTrailer(trailer)}
                      accessibilityRole="button"
                      accessible
                      accessibilityLabel={`${trailer.registration_number}`}
                    >
                      <View style={styles.resultMain}>
                        <Text style={styles.resultReg}>{trailer.registration_number}</Text>
                        <Text style={styles.resultMeta}>
                          {[trailer.brand, t(`trailer.types.${trailer.type}`)].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      {trailer.vin ? <Text style={styles.resultVin}>VIN: {trailer.vin}</Text> : null}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.resultItemManual}
                    onPress={() => {
                      setRegistrationNumber(searchQuery.trim().toUpperCase());
                      setShowResults(false);
                      setSearchResults([]);
                    }}
                    accessibilityRole="button"
                    accessible
                    accessibilityLabel={t('handover.manualEntry')}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                    <Text style={styles.resultManualText}>{t('handover.manualEntry')}</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.resultItem}>
                    <Text style={styles.resultHint}>{t('handover.noTrailersFound')}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.resultItemManual}
                    onPress={() => {
                      setRegistrationNumber(searchQuery.trim().toUpperCase());
                      setShowResults(false);
                      setSearchResults([]);
                    }}
                    accessibilityRole="button"
                    accessible
                    accessibilityLabel={t('handover.manualEntry')}
                  >
                    <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
                    <Text style={styles.resultManualText}>{t('handover.manualEntry')}</Text>
                  </TouchableOpacity>
                </>
              )}
              </ScrollView>
            </View>
          )}
        </View>

        {isFromDb && (
          <View style={styles.selectedBadge}>
            <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
            <Text style={styles.selectedBadgeText}>{t('handover.trailerFromDb')}</Text>
          </View>
        )}

        {(!isFromDb && !showResults && registrationNumber.trim()) && (
          <View style={styles.manualBadge}>
            <Ionicons name="create-outline" size={16} color={Colors.warning} />
            <Text style={styles.manualBadgeText}>{t('handover.manualEntry')}</Text>
          </View>
        )}

        <Text style={styles.label}>{t('handover.vin')}</Text>
        <TextInput
          style={[styles.input, isFromDb && styles.inputDisabled]}
          value={vin}
          onChangeText={isFromDb ? undefined : setVin}
          editable={!isFromDb}
          placeholder={t('handover.vin')}
          placeholderTextColor={Colors.gray400}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>{t('handover.brand')}</Text>
        <TextInput
          style={[styles.input, isFromDb && styles.inputDisabled]}
          value={brand}
          onChangeText={isFromDb ? undefined : setBrand}
          editable={!isFromDb}
          placeholder={t('handover.brand')}
          placeholderTextColor={Colors.gray400}
        />

        <Text style={styles.label}>{t('handover.trailerType')} *</Text>
        <View style={styles.typeRow}>
          {TRAILER_TYPES.map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.typeChip,
                trailerType === type && styles.typeChipActive,
                isFromDb && styles.typeChipDisabled,
              ]}
              onPress={isFromDb ? undefined : () => setTrailerType(type)}
              disabled={isFromDb}
              accessibilityRole="button"
              accessible
              accessibilityLabel={t(`trailer.types.${type}`)}
              accessibilityState={{ selected: trailerType === type, disabled: isFromDb }}
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

        <Text style={styles.label}>{t('handover.documents')}</Text>
        <View style={styles.switchRow}>
          <Switch
            value={hasDocuments}
            onValueChange={setHasDocuments}
            trackColor={{ false: Colors.gray200, true: Colors.primary }}
            thumbColor={Colors.white}
          />
          <Text style={styles.switchLabel}>
            {hasDocuments ? t('common.yes') : t('common.no')}
          </Text>
        </View>

        <Text style={styles.label}>{t('handover.beams')}</Text>
        <TextInput style={styles.input} value={beamsCount} onChangeText={setBeamsCount}
          placeholder="0" placeholderTextColor={Colors.gray400}
          keyboardType="number-pad" />

        <Text style={styles.label}>{t('handover.straps')}</Text>
        <TextInput style={styles.input} value={strapsCount} onChangeText={setStrapsCount}
          placeholder="0" placeholderTextColor={Colors.gray400}
          keyboardType="number-pad" />

        <Text style={styles.label}>{t('handover.equipment')}</Text>
        <TextInput style={[styles.input, styles.textArea]} value={equipmentNotes}
          onChangeText={setEquipmentNotes} placeholder={t('handover.equipmentNotes')}
          placeholderTextColor={Colors.gray400} multiline numberOfLines={4} />
      </ScrollView>
    );
  };

  const issueCount = Object.values(photos).filter((p) => p?.hasIssue).length;

  const renderPhotosStep = () => (
    <View style={{ flex: 1 }}>
      {lastReturnDate && (
        <View style={styles.preloadedBanner}>
          <Ionicons name="images-outline" size={16} color={Colors.warning} />
          <Text style={styles.preloadedBannerText}>
            {t('handover.preloadedBanner', { date: lastReturnDate })}
          </Text>
        </View>
      )}
      {issueCount > 0 && (
        <View style={styles.issueBanner}>
          <Ionicons name="warning" size={16} color={Colors.danger} />
          <Text style={styles.issueBannerText}>
            {t('handover.issueCountBanner', { count: issueCount })}
          </Text>
        </View>
      )}
      <TrailerTemplate
        photos={photos}
        onZonePress={handleZonePress}
      />
    </View>
  );

  const renderSummary = () => {
    const photoEntries = Object.values(photos).filter(Boolean) as ZonePhoto[];
    const issuePhotos = photoEntries.filter((p) => p.hasIssue);

    return (
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

        <Text style={styles.sectionTitle}>{t('handover.documents')}</Text>
        <Text style={styles.summaryText}>{hasDocuments ? t('common.yes') : t('common.no')}</Text>

        <Text style={styles.sectionTitle}>{t('handover.beams')}</Text>
        <Text style={styles.summaryText}>{beamsCount || '0'} {t('handover.pcs')}</Text>

        <Text style={styles.sectionTitle}>{t('handover.straps')}</Text>
        <Text style={styles.summaryText}>{strapsCount || '0'} {t('handover.pcs')}</Text>

        {equipmentNotes ? (
          <>
            <Text style={styles.sectionTitle}>{t('handover.equipment')}</Text>
            <Text style={styles.summaryText}>{equipmentNotes}</Text>
          </>
        ) : null}

        <Text style={styles.sectionTitle}>{t('handover.photos')}</Text>
        <Text style={styles.summaryDetail}>{t('handover.photosCount', { count: photoEntries.length })}</Text>

        {issuePhotos.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: Colors.danger }]}>
              {t('handover.issuesCount', { count: issuePhotos.length })}
            </Text>
            {issuePhotos.map((p, i) => (
              <Text key={i} style={styles.issueItem}>
                • {t(POSITION_LABELS[p.position])}: {p.issueDescription}
              </Text>
            ))}
          </>
        )}
      </ScrollView>
    );
  };

  const steps = [renderCompanyStep, renderTrailerStep, renderPhotosStep, renderSummary];
  const stepLabels = [t('handover.company'), t('handover.trailer'), t('handover.photos'), t('handover.summary')];

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
        <View style={styles.stepHeader}>
          <Text style={styles.stepHeaderTitle}>{stepLabels[step]}</Text>
          <Text style={styles.stepHeaderSubtitle}>
            {t('handover.stepOf', { current: step + 1, total: steps.length })}
          </Text>
        </View>
        {steps[step]()}
      </View>

      {/* Navigation */}
      <View style={styles.nav}>
        {step > 0 && (
          <TouchableOpacity
            style={[styles.navBtnSecondary, loading && styles.navBtnDisabled]}
            onPress={() => setStep(step - 1)}
            disabled={loading}
            accessibilityRole="button"
            accessible
            accessibilityLabel={t('common.back')}
            accessibilityState={{ disabled: loading }}
          >
            <Text style={styles.navBtnSecondaryText}>{t('common.back')}</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {step < steps.length - 1 ? (
          <TouchableOpacity
            style={[styles.navBtn, loading && styles.navBtnDisabled]}
            onPress={handleNext}
            disabled={loading}
            accessibilityRole="button"
            accessible
            accessibilityLabel={t('common.next')}
            accessibilityState={{ disabled: loading }}
          >
            <Text style={styles.navBtnText}>{t('common.next')}</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.white} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.navBtn, { backgroundColor: Colors.success }, loading && styles.navBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            accessibilityRole="button"
            accessible
            accessibilityLabel={t('common.submit')}
            accessibilityState={{ disabled: loading }}
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
          showIssueFields
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
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.background,
    borderBottomWidth: 0.5,
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
  stepHeader: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepHeaderTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.text,
  },
  stepHeaderSubtitle: {
    marginTop: 2,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
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
  inputDisabled: { backgroundColor: Colors.gray100, color: Colors.gray500 },
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
  searchContainer: { position: 'relative', zIndex: 20 },
  searchInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    zIndex: 20,
  },
  searchIcon: { marginRight: Spacing.xs },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  searchSpinner: { marginLeft: Spacing.xs },
  clearBtn: { padding: Spacing.xs },
  resultsDropdown: {
    position: 'absolute',
    top: 52,
    left: 0,
    right: 0,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
    maxHeight: 240,
    zIndex: 100,
    elevation: 8,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    overflow: 'hidden',
  },
  resultItem: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  resultMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  resultReg: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  resultMeta: { fontSize: FontSize.sm, color: Colors.textSecondary },
  resultVin: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
  resultHint: { fontSize: FontSize.sm, color: Colors.textSecondary, fontStyle: 'italic' },
  resultItemManual: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  resultManualText: { fontSize: FontSize.sm, color: Colors.primary, fontWeight: '600' },
  selectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: '#ecfdf5',
    borderRadius: BorderRadius.sm,
  },
  selectedBadgeText: { fontSize: FontSize.xs, color: Colors.success, fontWeight: '600' },
  manualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: '#fffbeb',
    borderRadius: BorderRadius.sm,
  },
  manualBadgeText: { fontSize: FontSize.xs, color: Colors.warning, fontWeight: '600' },
  typeChipDisabled: { opacity: 0.5 },
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
    backgroundColor: Colors.background,
    borderTopWidth: 0.5,
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
  navBtnDisabled: { opacity: 0.6 },
  navBtnSecondaryText: { color: Colors.textSecondary, fontSize: FontSize.md },
  summaryText: { fontSize: FontSize.md, color: Colors.text, fontWeight: '600' },
  summaryDetail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  issueItem: { fontSize: FontSize.sm, color: Colors.danger, marginTop: 2, fontWeight: '500' },
  preloadedBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: 0,
    padding: Spacing.sm,
    backgroundColor: '#fffbeb',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.warning,
  },
  preloadedBannerText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: '#92400e',
    lineHeight: 16,
  },
  issueBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.xs,
    padding: Spacing.sm,
    backgroundColor: '#fef2f2',
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
  issueBannerText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.danger,
    fontWeight: '600',
  },
});
