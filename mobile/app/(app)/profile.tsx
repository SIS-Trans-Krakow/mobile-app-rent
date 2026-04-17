import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import api, { getUploadsUrl } from '../../services/api';
import SignaturePad from '../../components/SignaturePad';
import { BorderRadius, Colors, FontSize, Spacing } from '../../constants/theme';
import { showPlatformAlert } from '../../utils/showPlatformAlert';
import { KeyboardAwareScrollView } from '../../utils/keyboardController';

const ScrollContainer: React.ComponentType<any> = KeyboardAwareScrollView;

export default function ProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [signaturePath, setSignaturePath] = useState<string | null>(null);
  const [padOpen, setPadOpen] = useState(false);
  const [imgVersion, setImgVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadSignature();
    }, [])
  );

  const loadSignature = async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/me/signature');
      setSignaturePath(res.data?.signature_path || null);
      setImgVersion((v) => v + 1);
    } catch (err) {
      console.error('Load signature error:', err);
      showPlatformAlert(t('common.error'), t('profile.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const uploadBase64 = async (dataUrl: string) => {
    setSaving(true);
    try {
      await api.put('/auth/me/signature', { signature_base64: dataUrl });
      await loadSignature();
      showPlatformAlert(t('common.success'), t('profile.signatureUpdated'));
    } catch (err: any) {
      showPlatformAlert(t('common.error'), err?.response?.data?.error || t('profile.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const handleSavedFromPad = async (sig: string) => {
    setPadOpen(false);
    await uploadBase64(sig);
  };

  const handleUploadPng = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 1,
      allowsEditing: false,
      mediaTypes: ['images'],
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const uri = asset.uri;
    const isPng =
      (asset.mimeType && asset.mimeType.toLowerCase() === 'image/png')
      || uri.toLowerCase().endsWith('.png');

    if (!isPng) {
      showPlatformAlert(t('common.error'), t('profile.uploadInvalid'));
      return;
    }

    try {
      const file = new File(uri);
      const base64 = await file.base64();
      const dataUrl = `data:image/png;base64,${base64}`;
      await uploadBase64(dataUrl);
    } catch (err) {
      console.error('Read png file error:', err);
      showPlatformAlert(t('common.error'), t('profile.saveError'));
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      await api.delete('/auth/me/signature');
      setSignaturePath(null);
      showPlatformAlert(t('common.success'), t('profile.signatureRemoved'));
    } catch (err: any) {
      showPlatformAlert(t('common.error'), err?.response?.data?.error || t('profile.saveError'));
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

  const previewUri = signaturePath
    ? `${getUploadsUrl(signaturePath)}?v=${imgVersion}`
    : null;

  return (
    <ScrollContainer
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={Colors.gray700} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('profile.title')}</Text>
        <View style={{ width: 32 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>{t('profile.signatureSection')}</Text>
        <Text style={styles.sectionDesc}>{t('profile.signatureDescription')}</Text>

        <View style={styles.previewWrap}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.preview} resizeMode="contain" />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="create-outline" size={36} color={Colors.gray400} />
              <Text style={styles.placeholderText}>{t('profile.signatureMissing')}</Text>
            </View>
          )}
        </View>

        <View style={styles.statusRow}>
          <Ionicons
            name={signaturePath ? 'checkmark-circle' : 'alert-circle-outline'}
            size={18}
            color={signaturePath ? Colors.success : Colors.gray400}
          />
          <Text style={[styles.statusText, { color: signaturePath ? Colors.success : Colors.gray500 }]}>
            {signaturePath ? t('profile.signaturePresent') : t('profile.signatureMissing')}
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.btn, styles.primaryBtn]}
          onPress={() => setPadOpen(true)}
          disabled={saving}
        >
          <Ionicons name="finger-print" size={20} color={Colors.white} />
          <Text style={styles.primaryBtnText}>{t('profile.drawSignature')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, styles.secondaryBtn]}
          onPress={handleUploadPng}
          disabled={saving}
        >
          <Ionicons name="cloud-upload-outline" size={20} color={Colors.primary} />
          <Text style={styles.secondaryBtnText}>{t('profile.uploadPng')}</Text>
        </TouchableOpacity>

        {signaturePath && (
          <TouchableOpacity
            style={[styles.btn, styles.dangerBtn]}
            onPress={handleRemove}
            disabled={saving}
          >
            <Ionicons name="trash-outline" size={20} color={Colors.danger} />
            <Text style={styles.dangerBtnText}>{t('profile.removeSignature')}</Text>
          </TouchableOpacity>
        )}

        {saving && (
          <View style={styles.savingOverlay}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        )}
      </View>

      <SignaturePad
        visible={padOpen}
        onClose={() => setPadOpen(false)}
        onSave={handleSavedFromPad}
        title={t('profile.signatureSection')}
      />
    </ScrollContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
    ...(Platform.OS === 'web' ? { paddingTop: 0 } : { paddingTop: Spacing.sm }),
  },
  backBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  sectionDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  previewWrap: { marginTop: Spacing.sm },
  preview: {
    width: '100%',
    height: 160,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  placeholder: {
    width: '100%',
    height: 160,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  placeholderText: { color: Colors.gray500, fontSize: FontSize.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, marginTop: Spacing.xs },
  statusText: { fontSize: FontSize.sm, fontWeight: '600' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  primaryBtn: { backgroundColor: Colors.primary },
  primaryBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  secondaryBtn: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.primary },
  secondaryBtnText: { color: Colors.primary, fontWeight: '700', fontSize: FontSize.md },
  dangerBtn: { backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.danger },
  dangerBtnText: { color: Colors.danger, fontWeight: '700', fontSize: FontSize.md },
  savingOverlay: { paddingTop: Spacing.sm, alignItems: 'center' },
});
