import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  Alert, ActivityIndicator, Modal, Platform, ScrollView,
} from 'react-native';
import { KeyboardAwareScrollView } from '../../../utils/keyboardController';

const ScrollContainer: React.ComponentType<any> = KeyboardAwareScrollView;
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import api from '../../../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  parse_errors: Array<{ line: number; raw: string; reason: string }>;
  skipped_rows: Array<{ registration_number: string; reason: string }>;
}

const TRAILER_TYPES = ['Kurtyna', 'Box', 'Izoterma', 'Chłodnia', 'Kurtyna MEGA', 'TANDEM', 'Double Deck'] as const;

interface TrailerItem {
  id: number;
  registration_number: string;
  vin: string;
  brand: string;
  type: string;
  production_date: string;
}

export default function TrailersScreen() {
  const { t } = useTranslation();
  const [trailers, setTrailers] = useState<TrailerItem[]>([]);
  const [filtered, setFiltered] = useState<TrailerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingTrailer, setEditingTrailer] = useState<TrailerItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [formRegNumber, setFormRegNumber] = useState('');
  const [formVin, setFormVin] = useState('');
  const [formBrand, setFormBrand] = useState('');
  const [formType, setFormType] = useState<string>(TRAILER_TYPES[0]);
  const [formProductionDate, setFormProductionDate] = useState('');

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importModalVisible, setImportModalVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadTrailers();
    }, [])
  );

  const loadTrailers = async () => {
    try {
      const res = await api.get('/trailers');
      setTrailers(res.data);
      filterList(res.data, searchQuery);
    } catch (err) {
      console.error('Load trailers error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterList = (data: TrailerItem[], query: string) => {
    if (!query.trim()) {
      setFiltered(data);
      return;
    }
    const q = query.toLowerCase();
    setFiltered(
      data.filter(
        (tr) =>
          tr.registration_number.toLowerCase().includes(q) ||
          tr.vin.toLowerCase().includes(q) ||
          tr.brand.toLowerCase().includes(q) ||
          tr.type.toLowerCase().includes(q)
      )
    );
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    filterList(trailers, text);
  };

  const openCreateModal = () => {
    setEditingTrailer(null);
    setFormRegNumber('');
    setFormVin('');
    setFormBrand('');
    setFormType(TRAILER_TYPES[0]);
    setFormProductionDate('');
    setModalVisible(true);
  };

  const openEditModal = (trailer: TrailerItem) => {
    setEditingTrailer(trailer);
    setFormRegNumber(trailer.registration_number);
    setFormVin(trailer.vin);
    setFormBrand(trailer.brand);
    setFormType(trailer.type);
    setFormProductionDate(trailer.production_date);
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formRegNumber.trim() || !formType) {
      Alert.alert(t('common.error'), t('common.required'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        registration_number: formRegNumber.trim(),
        vin: formVin.trim(),
        brand: formBrand.trim(),
        type: formType,
        production_date: formProductionDate.trim(),
      };

      if (editingTrailer) {
        await api.patch(`/trailers/${editingTrailer.id}`, payload);
        showAlert(t('common.success'), t('admin.trailerUpdated'));
      } else {
        await api.post('/trailers', payload);
        showAlert(t('common.success'), t('admin.trailerCreated'));
      }
      setModalVisible(false);
      loadTrailers();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.error || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (trailer: TrailerItem) => {
    Alert.alert(
      t('common.delete'),
      `${t('admin.deleteTrailerConfirm')} ${trailer.registration_number}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await api.delete(`/trailers/${trailer.id}`);
              showAlert(t('common.success'), t('admin.trailerDeleted'));
              loadTrailers();
            } catch (err: any) {
              showAlert(t('common.error'), err?.response?.data?.error || 'Error');
            }
          },
        },
      ]
    );
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert(title, message);
    }
  };

  const readPickedCsvAsText = async (
    asset: DocumentPicker.DocumentPickerAsset
  ): Promise<string> => {
    if (Platform.OS === 'web' && asset.file) {
      return asset.file.text();
    }
    // expo-file-system v19+ exposes a File class with an async text() reader.
    const { File } = await import('expo-file-system');
    return new File(asset.uri).text();
  };

  const handleImportCsv = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      setImporting(true);
      const csv = await readPickedCsvAsText(asset);

      if (!csv.trim()) {
        showAlert(t('common.error'), t('admin.importEmptyFile'));
        return;
      }

      const res = await api.post<ImportResult>('/trailers/import', { csv });
      setImportResult(res.data);
      setImportModalVisible(true);
      loadTrailers();
    } catch (err: any) {
      console.error('Import CSV error:', err);
      showAlert(
        t('common.error'),
        err?.response?.data?.error || err?.message || t('admin.importError')
      );
    } finally {
      setImporting(false);
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
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={Colors.gray400} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={handleSearch}
          placeholder={t('common.search')}
          placeholderTextColor={Colors.gray400}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.gray400} />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.countText}>
        {filtered.length} / {trailers.length}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => openEditModal(item)}
            activeOpacity={0.7}
          >
            <View style={styles.cardContent}>
              <Text style={styles.regNumber}>{item.registration_number}</Text>
              <Text style={styles.trailerDetail}>
                {item.brand ? `${item.brand} · ` : ''}{t(`trailer.types.${item.type}`)}
              </Text>
              {item.vin ? <Text style={styles.vinText}>VIN: {item.vin}</Text> : null}
              {item.production_date ? (
                <Text style={styles.vinText}>{t('trailer.productionDate')}: {item.production_date}</Text>
              ) : null}
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity
                style={styles.editIconBtn}
                onPress={() => openEditModal(item)}
              >
                <Ionicons name="create-outline" size={18} color={Colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteIconBtn}
                onPress={() => handleDelete(item)}
              >
                <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('common.noData')}</Text>
        }
      />

      <TouchableOpacity
        style={[styles.fab, styles.fabImport]}
        onPress={handleImportCsv}
        disabled={importing}
        accessibilityLabel={t('admin.importCsv')}
      >
        {importing ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Ionicons name="cloud-upload-outline" size={24} color={Colors.white} />
        )}
      </TouchableOpacity>

      <TouchableOpacity style={styles.fab} onPress={openCreateModal}>
        <Ionicons name="add" size={28} color={Colors.white} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingTrailer ? t('admin.editTrailer') : t('admin.createTrailer')}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollContainer style={styles.modalBody} keyboardShouldPersistTaps="handled" bottomOffset={Spacing.lg}>
            <Text style={styles.label}>{t('admin.registrationNumber')} *</Text>
            <TextInput
              style={styles.input}
              value={formRegNumber}
              onChangeText={setFormRegNumber}
              placeholder={t('admin.registrationNumber')}
              placeholderTextColor={Colors.gray400}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>{t('admin.vin')}</Text>
            <TextInput
              style={styles.input}
              value={formVin}
              onChangeText={setFormVin}
              placeholder={t('admin.vin')}
              placeholderTextColor={Colors.gray400}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>{t('admin.brand')}</Text>
            <TextInput
              style={styles.input}
              value={formBrand}
              onChangeText={setFormBrand}
              placeholder={t('admin.brand')}
              placeholderTextColor={Colors.gray400}
              autoCapitalize="characters"
            />

            <Text style={styles.label}>{t('admin.productionDate')}</Text>
            <TextInput
              style={styles.input}
              value={formProductionDate}
              onChangeText={setFormProductionDate}
              placeholder="RRRR lub RRRR-MM-DD"
              placeholderTextColor={Colors.gray400}
              keyboardType="default"
            />

            <Text style={styles.label}>{t('admin.trailerType')} *</Text>
            <View style={styles.typeRow}>
              {TRAILER_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, formType === type && styles.typeChipActive]}
                  onPress={() => setFormType(type)}
                >
                  <Text style={[styles.typeChipText, formType === type && styles.typeChipTextActive]}>
                    {t(`trailer.types.${type}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>{t('common.save')}</Text>
              )}
            </TouchableOpacity>
          </ScrollContainer>
        </View>
      </Modal>

      <Modal
        visible={importModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setImportModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setImportModalVisible(false)}>
              <Ionicons name="close" size={28} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{t('admin.importResultTitle')}</Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: Spacing.xxl }}>
            {importResult && (
              <>
                <View style={styles.summaryRow}>
                  <View style={[styles.summaryBox, { backgroundColor: '#ecfdf5' }]}>
                    <Text style={[styles.summaryNumber, { color: Colors.success }]}>
                      {importResult.imported}
                    </Text>
                    <Text style={styles.summaryLabel}>{t('admin.importImported')}</Text>
                  </View>
                  <View style={[styles.summaryBox, { backgroundColor: '#fef3c7' }]}>
                    <Text style={[styles.summaryNumber, { color: '#b45309' }]}>
                      {importResult.skipped}
                    </Text>
                    <Text style={styles.summaryLabel}>{t('admin.importSkipped')}</Text>
                  </View>
                  <View style={[styles.summaryBox, { backgroundColor: '#fee2e2' }]}>
                    <Text style={[styles.summaryNumber, { color: Colors.danger }]}>
                      {importResult.parse_errors.length}
                    </Text>
                    <Text style={styles.summaryLabel}>{t('admin.importErrors')}</Text>
                  </View>
                </View>

                {importResult.skipped_rows.length > 0 && (
                  <>
                    <Text style={styles.sectionHeader}>{t('admin.importSkippedSection')}</Text>
                    {importResult.skipped_rows.map((row, idx) => (
                      <View key={`skipped-${idx}`} style={styles.errorRow}>
                        <Text style={styles.errorRegNumber}>{row.registration_number}</Text>
                        <Text style={styles.errorReason}>{t('admin.importDuplicate')}</Text>
                      </View>
                    ))}
                  </>
                )}

                {importResult.parse_errors.length > 0 && (
                  <>
                    <Text style={styles.sectionHeader}>{t('admin.importErrorsSection')}</Text>
                    {importResult.parse_errors.map((err, idx) => (
                      <View key={`err-${idx}`} style={styles.errorRow}>
                        <Text style={styles.errorRegNumber}>
                          {t('admin.importLine')} {err.line}
                        </Text>
                        <Text style={styles.errorReason}>{err.reason}</Text>
                        <Text style={styles.errorRaw}>{err.raw}</Text>
                      </View>
                    ))}
                  </>
                )}

                <Text style={styles.formatHint}>{t('admin.importFormatHint')}</Text>
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  searchIcon: { marginRight: Spacing.sm },
  searchInput: {
    flex: 1,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  countText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginRight: Spacing.md,
    marginTop: Spacing.xs,
  },
  list: { padding: Spacing.md, paddingBottom: 80 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardContent: { flex: 1 },
  regNumber: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  trailerDetail: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  vinText: { fontSize: FontSize.xs, color: Colors.gray400, marginTop: 2 },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  editIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
    backgroundColor: '#eff6ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    textAlign: 'center',
    color: Colors.textSecondary,
    marginTop: Spacing.xl,
    fontSize: FontSize.md,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 6,
  },
  fabImport: {
    right: Spacing.lg + 56 + Spacing.md,
    backgroundColor: Colors.primary,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  summaryBox: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  summaryNumber: { fontSize: FontSize.xl, fontWeight: '700' },
  summaryLabel: {
    fontSize: FontSize.xs,
    color: Colors.gray700,
    textAlign: 'center',
    marginTop: 2,
  },
  sectionHeader: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  errorRow: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  errorRegNumber: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  errorReason: { fontSize: FontSize.xs, color: Colors.danger, marginTop: 2 },
  errorRaw: { fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 2, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  formatHint: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: '#eff6ff',
    borderRadius: BorderRadius.sm,
    fontSize: FontSize.xs,
    color: Colors.gray700,
  },
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingTop: Spacing.xl,
  },
  modalTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  modalBody: { padding: Spacing.lg },
  label: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.gray700,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
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
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.xxl,
  },
  saveBtnText: { color: Colors.white, fontSize: FontSize.md, fontWeight: '600' },
});
