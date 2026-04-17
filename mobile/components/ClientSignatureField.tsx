import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Colors, FontSize, Spacing } from '../constants/theme';
import SignaturePad from './SignaturePad';

interface Props {
  signatureBase64: string | null;
  onChange: (signatureBase64: string | null) => void;
  title?: string;
  description?: string;
}

export default function ClientSignatureField({ signatureBase64, onChange, title, description }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const handleSave = (sig: string) => {
    onChange(sig);
    setOpen(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="create-outline" size={20} color={Colors.primary} />
        <Text style={styles.title}>{title || t('signature.clientSignatureTitle')}</Text>
      </View>
      <Text style={styles.description}>{description || t('signature.optional')}</Text>

      {signatureBase64 ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: signatureBase64 }} style={styles.preview} resizeMode="contain" />
          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.btn, styles.changeBtn]} onPress={() => setOpen(true)}>
              <Ionicons name="pencil" size={18} color={Colors.primary} />
              <Text style={styles.changeText}>{t('signature.change')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.btn, styles.removeBtn]} onPress={() => onChange(null)}>
              <Ionicons name="trash-outline" size={18} color={Colors.danger} />
              <Text style={styles.removeText}>{t('signature.remove')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <TouchableOpacity style={styles.addBtn} onPress={() => setOpen(true)} accessibilityRole="button">
          <Ionicons name="finger-print" size={22} color={Colors.white} />
          <Text style={styles.addBtnText}>{t('signature.addClientSignature')}</Text>
        </TouchableOpacity>
      )}

      <SignaturePad
        visible={open}
        onClose={() => setOpen(false)}
        onSave={handleSave}
        title={title || t('signature.clientSignatureTitle')}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  title: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  description: { fontSize: FontSize.sm, color: Colors.textSecondary },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  addBtnText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  previewWrap: { gap: Spacing.sm },
  preview: {
    width: '100%',
    height: 140,
    backgroundColor: Colors.gray50,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionsRow: { flexDirection: 'row', gap: Spacing.sm },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  changeBtn: { borderColor: Colors.primary, backgroundColor: Colors.white },
  changeText: { color: Colors.primary, fontWeight: '600' },
  removeBtn: { borderColor: Colors.danger, backgroundColor: Colors.white },
  removeText: { color: Colors.danger, fontWeight: '600' },
});
