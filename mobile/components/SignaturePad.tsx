import React, { useRef, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import SignatureScreen, { SignatureViewRef } from 'react-native-signature-canvas';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { BorderRadius, Colors, FontSize, Spacing } from '../constants/theme';
import { showPlatformAlert } from '../utils/showPlatformAlert';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSave: (signatureBase64: string) => void;
  title?: string;
}

const PAD_STYLE = `
  .m-signature-pad {
    box-shadow: none;
    border: none;
    margin: 0;
    height: 100%;
  }
  .m-signature-pad--body {
    border: none;
    height: 100%;
  }
  .m-signature-pad--body canvas {
    background-color: #ffffff;
  }
  .m-signature-pad--footer { display: none; }
  body, html {
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    background-color: #ffffff;
  }
`;

export default function SignaturePad({ visible, onClose, onSave, title }: Props) {
  const { t } = useTranslation();
  const ref = useRef<SignatureViewRef>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const handleOK = (signature: string) => {
    if (!signature) {
      showPlatformAlert(t('common.error'), t('signature.empty'));
      return;
    }
    onSave(signature);
  };

  const handleEmpty = () => {
    showPlatformAlert(t('common.error'), t('signature.empty'));
  };

  const handleClear = () => {
    ref.current?.clearSignature();
    setIsEmpty(true);
  };

  const handleSavePress = () => {
    ref.current?.readSignature();
  };

  const handleBegin = () => {
    setIsEmpty(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn} accessibilityRole="button">
            <Ionicons name="close" size={26} color={Colors.gray700} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {title || t('signature.padTitle')}
          </Text>
          <View style={styles.headerBtn} />
        </View>

        <Text style={styles.hint}>{t('signature.padHint')}</Text>

        <View style={styles.padContainer}>
          <SignatureScreen
            ref={ref}
            onOK={handleOK}
            onEmpty={handleEmpty}
            onBegin={handleBegin}
            webStyle={PAD_STYLE}
            backgroundColor="#ffffff"
            penColor="#111827"
            descriptionText=""
            autoClear={false}
            imageType="image/png"
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity style={[styles.btn, styles.clearBtn]} onPress={handleClear}>
            <Ionicons name="trash-outline" size={20} color={Colors.gray700} />
            <Text style={styles.clearText}>{t('signature.clear')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, styles.saveBtn, isEmpty && styles.saveBtnDisabled]}
            onPress={handleSavePress}
            disabled={isEmpty}
          >
            <Ionicons name="checkmark" size={22} color={Colors.white} />
            <Text style={styles.saveText}>{t('signature.save')}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  headerBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  hint: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  padContainer: {
    flex: 1,
    marginHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.gray300,
    overflow: 'hidden',
    backgroundColor: Colors.white,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  clearBtn: { backgroundColor: Colors.gray100, borderWidth: 1, borderColor: Colors.gray300 },
  clearText: { color: Colors.gray700, fontWeight: '600', fontSize: FontSize.md },
  saveBtn: { backgroundColor: Colors.primary },
  saveBtnDisabled: { backgroundColor: Colors.gray400 },
  saveText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
});
