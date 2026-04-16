import { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList,
  Alert, ActivityIndicator, Modal, ScrollView, Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import api from '../../../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';
import { CompanyItem } from '../../../types/company';

export default function CompaniesScreen() {
  const { t } = useTranslation();
  const [companies, setCompanies] = useState<CompanyItem[]>([]);
  const [filtered, setFiltered] = useState<CompanyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [modalVisible, setModalVisible] = useState(false);
  const [editingCompany, setEditingCompany] = useState<CompanyItem | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formTaxId, setFormTaxId] = useState('');
  const [formAddressLine1, setFormAddressLine1] = useState('');
  const [formAddressLine2, setFormAddressLine2] = useState('');
  const [formPostalCode, setFormPostalCode] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formContact, setFormContact] = useState('');

  useFocusEffect(
    useCallback(() => {
      void loadCompanies();
    }, [])
  );

  const loadCompanies = async () => {
    try {
      setLoading(true);
      const res = await api.get('/companies', { params: { limit: 200 } });
      setCompanies(res.data || []);
      filterList(res.data || [], searchQuery);
    } catch (err) {
      console.error('Load companies error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterList = (data: CompanyItem[], query: string) => {
    if (!query.trim()) {
      setFiltered(data);
      return;
    }

    const normalized = query.toLowerCase();
    const normalizedNip = query.replace(/[-.\s]/g, '');
    setFiltered(
      data.filter((company) =>
        company.name.toLowerCase().includes(normalized)
        || company.contact_person.toLowerCase().includes(normalized)
        || company.address_line1.toLowerCase().includes(normalized)
        || company.address_line2.toLowerCase().includes(normalized)
        || company.tax_id.replace(/[-.\s]/g, '').includes(normalizedNip)
      )
    );
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    filterList(companies, text);
  };

  const openCreateModal = () => {
    setEditingCompany(null);
    setFormName('');
    setFormTaxId('');
    setFormAddressLine1('');
    setFormAddressLine2('');
    setFormPostalCode('');
    setFormPhone('');
    setFormEmail('');
    setFormContact('');
    setModalVisible(true);
  };

  const openEditModal = (company: CompanyItem) => {
    setEditingCompany(company);
    setFormName(company.name || '');
    setFormTaxId(company.tax_id || '');
    setFormAddressLine1(company.address_line1 || company.address || '');
    setFormAddressLine2(company.address_line2 || '');
    setFormPostalCode(company.postal_code || '');
    setFormPhone(company.phone || '');
    setFormEmail(company.email || '');
    setFormContact(company.contact_person || '');
    setModalVisible(true);
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      showAlert(t('common.error'), t('common.required'));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        tax_id: formTaxId.trim(),
        address_line1: formAddressLine1.trim(),
        address_line2: formAddressLine2.trim(),
        postal_code: formPostalCode.trim(),
        phone: formPhone.trim(),
        email: formEmail.trim(),
        contact_person: formContact.trim(),
      };

      if (editingCompany) {
        await api.patch(`/companies/${editingCompany.id}`, payload);
        showAlert(t('common.success'), t('admin.companyUpdated'));
      } else {
        await api.post('/companies', payload);
        showAlert(t('common.success'), t('admin.companyCreated'));
      }

      setModalVisible(false);
      await loadCompanies();
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.error || 'Error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (company: CompanyItem) => {
    const runDelete = async () => {
      try {
        await api.delete(`/companies/${company.id}`);
        showAlert(t('common.success'), t('admin.companyDeleted'));
        await loadCompanies();
      } catch (err: any) {
        showAlert(t('common.error'), err?.response?.data?.error || 'Error');
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`${t('admin.deleteCompanyConfirm')} ${company.name}?`);
      if (confirmed) {
        void runDelete();
      }
      return;
    }

    Alert.alert(
      t('common.delete'),
      `${t('admin.deleteCompanyConfirm')} ${company.name}?`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => { void runDelete(); },
        },
      ]
    );
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
          placeholder={t('handover.searchCompanyPlaceholder')}
          placeholderTextColor={Colors.gray400}
          autoCapitalize="none"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={() => handleSearch('')}>
            <Ionicons name="close-circle" size={18} color={Colors.gray400} />
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.countText}>
        {filtered.length} / {companies.length}
      </Text>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => {
          const address = [item.address_line1 || item.address, item.address_line2, item.postal_code]
            .filter(Boolean)
            .join(', ');

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => openEditModal(item)}
              activeOpacity={0.7}
            >
              <View style={styles.cardContent}>
                <Text style={styles.companyName}>{item.name}</Text>
                {item.tax_id ? <Text style={styles.companyMeta}>NIP: {item.tax_id}</Text> : null}
                {address ? <Text style={styles.companyMeta}>{address}</Text> : null}
                {item.contact_person ? <Text style={styles.companyMeta}>{item.contact_person}</Text> : null}
                {item.phone ? <Text style={styles.companyMeta}>{item.phone}</Text> : null}
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
          );
        }}
        ListEmptyComponent={
          <Text style={styles.emptyText}>{t('common.noData')}</Text>
        }
      />

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
              {editingCompany ? t('admin.editCompany') : t('admin.createCompany')}
            </Text>
            <View style={{ width: 28 }} />
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{t('handover.companyName')} *</Text>
            <TextInput
              style={styles.input}
              value={formName}
              onChangeText={setFormName}
              placeholder={t('handover.companyName')}
              placeholderTextColor={Colors.gray400}
            />

            <Text style={styles.label}>{t('handover.companyTaxId')}</Text>
            <TextInput
              style={styles.input}
              value={formTaxId}
              onChangeText={setFormTaxId}
              placeholder={t('handover.companyTaxId')}
              placeholderTextColor={Colors.gray400}
              keyboardType="number-pad"
            />

            <Text style={styles.label}>{t('handover.companyAddressLine1')}</Text>
            <TextInput
              style={styles.input}
              value={formAddressLine1}
              onChangeText={setFormAddressLine1}
              placeholder={t('handover.companyAddressLine1')}
              placeholderTextColor={Colors.gray400}
            />

            <Text style={styles.label}>{t('handover.companyAddressLine2')}</Text>
            <TextInput
              style={styles.input}
              value={formAddressLine2}
              onChangeText={setFormAddressLine2}
              placeholder={t('handover.companyAddressLine2')}
              placeholderTextColor={Colors.gray400}
            />

            <Text style={styles.label}>{t('handover.companyPostalCode')}</Text>
            <TextInput
              style={styles.input}
              value={formPostalCode}
              onChangeText={setFormPostalCode}
              placeholder={t('handover.companyPostalCode')}
              placeholderTextColor={Colors.gray400}
            />

            <Text style={styles.label}>{t('handover.companyPhone')}</Text>
            <TextInput
              style={styles.input}
              value={formPhone}
              onChangeText={setFormPhone}
              placeholder={t('handover.companyPhone')}
              placeholderTextColor={Colors.gray400}
              keyboardType="phone-pad"
            />

            <Text style={styles.label}>{t('handover.companyEmail')}</Text>
            <TextInput
              style={styles.input}
              value={formEmail}
              onChangeText={setFormEmail}
              placeholder={t('handover.companyEmail')}
              placeholderTextColor={Colors.gray400}
              autoCapitalize="none"
              keyboardType="email-address"
            />

            <Text style={styles.label}>{t('handover.companyContact')}</Text>
            <TextInput
              style={styles.input}
              value={formContact}
              onChangeText={setFormContact}
              placeholder={t('handover.companyContact')}
              placeholderTextColor={Colors.gray400}
            />

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={Colors.white} />
              ) : (
                <Text style={styles.saveBtnText}>{t('common.save')}</Text>
              )}
            </TouchableOpacity>
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
  companyName: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  companyMeta: { fontSize: FontSize.sm, color: Colors.textSecondary, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: Spacing.sm },
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
