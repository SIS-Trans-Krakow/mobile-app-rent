import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import api from '../../../services/api';
import { Colors, Spacing, FontSize, BorderRadius } from '../../../constants/theme';

interface CompanyProfileForm {
  name: string;
  address: string;
  tax_id: string;
  phone: string;
  email: string;
}

const EMPTY_FORM: CompanyProfileForm = {
  name: '',
  address: '',
  tax_id: '',
  phone: '',
  email: '',
};

export default function CompanyProfileScreen() {
  const { t } = useTranslation();
  const [form, setForm] = useState<CompanyProfileForm>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [])
  );

  const loadProfile = async () => {
    setLoading(true);
    try {
      const res = await api.get('/company-profile');
      setForm({
        name: res.data?.name || '',
        address: res.data?.address || '',
        tax_id: res.data?.tax_id || '',
        phone: res.data?.phone || '',
        email: res.data?.email || '',
      });
    } catch (err) {
      console.error('Load company profile error:', err);
      showAlert(t('common.error'), t('admin.companyProfileLoadError'));
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof CompanyProfileForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(message);
      return;
    }
    Alert.alert(title, message);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/company-profile', form);
      showAlert(t('common.success'), t('admin.companyProfileSaved'));
    } catch (err: any) {
      showAlert(t('common.error'), err?.response?.data?.error || 'Error');
    } finally {
      setSaving(false);
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
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.sectionDescription}>{t('admin.companyProfileHelper')}</Text>

      <Text style={styles.label}>{t('admin.companyName')}</Text>
      <TextInput
        style={styles.input}
        value={form.name}
        onChangeText={(value) => updateField('name', value)}
        placeholder={t('admin.companyName')}
        placeholderTextColor={Colors.gray400}
      />

      <Text style={styles.label}>{t('admin.companyAddress')}</Text>
      <TextInput
        style={[styles.input, styles.textArea]}
        value={form.address}
        onChangeText={(value) => updateField('address', value)}
        placeholder={t('admin.companyAddress')}
        placeholderTextColor={Colors.gray400}
        multiline
      />

      <Text style={styles.label}>{t('admin.companyTaxId')}</Text>
      <TextInput
        style={styles.input}
        value={form.tax_id}
        onChangeText={(value) => updateField('tax_id', value)}
        placeholder={t('admin.companyTaxId')}
        placeholderTextColor={Colors.gray400}
        keyboardType="number-pad"
      />

      <Text style={styles.label}>{t('admin.companyPhone')}</Text>
      <TextInput
        style={styles.input}
        value={form.phone}
        onChangeText={(value) => updateField('phone', value)}
        placeholder={t('admin.companyPhone')}
        placeholderTextColor={Colors.gray400}
        keyboardType="phone-pad"
      />

      <Text style={styles.label}>{t('admin.companyEmail')}</Text>
      <TextInput
        style={styles.input}
        value={form.email}
        onChangeText={(value) => updateField('email', value)}
        placeholder={t('admin.companyEmail')}
        placeholderTextColor={Colors.gray400}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={Colors.white} />
        ) : (
          <Text style={styles.saveBtnText}>{t('common.save')}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
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
  textArea: {
    minHeight: 88,
    textAlignVertical: 'top',
  },
  saveBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    padding: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  saveBtnText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
});
