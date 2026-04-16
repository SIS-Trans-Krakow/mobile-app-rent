import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image, StyleSheet,
  Modal, Platform, Switch,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { PhotoPosition, ZonePhoto } from './TrailerTemplate';
import { showPlatformAlert } from '../utils/showPlatformAlert';

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

interface Props {
  position: PhotoPosition;
  visible: boolean;
  onClose: () => void;
  onSave: (photo: ZonePhoto) => void;
  existingPhoto?: ZonePhoto;
  showIssueFields?: boolean;
  originalPhoto?: ZonePhoto;
}

export default function PhotoCapture({
  position, visible, onClose, onSave, existingPhoto, showIssueFields, originalPhoto,
}: Props) {
  const { t } = useTranslation();
  const hasOriginalIssue = !!originalPhoto?.hasIssue;

  const mergeIssueDescriptions = (baseText?: string, deltaText?: string) => {
    const base = baseText?.trim() || '';
    const delta = deltaText?.trim() || '';

    if (!base) return delta;
    if (!delta) return base;
    if (base.toLowerCase() === delta.toLowerCase()) return base;

    return `${base}; ${delta}`;
  };

  const buildInitialState = () => {
    const fallbackIssue = !existingPhoto && hasOriginalIssue;
    const existingDelta = existingPhoto?.newIssueDescription
      || (!hasOriginalIssue && existingPhoto?.hasIssue ? existingPhoto?.issueDescription : '')
      || '';

    return {
      uri: existingPhoto?.uri || '',
      description: existingPhoto?.description || '',
      hasIssue: hasOriginalIssue
        ? existingPhoto?.hasNewIssue || Boolean(existingDelta)
        : existingPhoto?.hasIssue || fallbackIssue || false,
      issueDescription: existingDelta,
    };
  };

  const [uri, setUri] = useState(buildInitialState().uri);
  const [description, setDescription] = useState(buildInitialState().description);
  const [hasIssue, setHasIssue] = useState(buildInitialState().hasIssue);
  const [issueDescription, setIssueDescription] = useState(buildInitialState().issueDescription);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showError = (message: string) => {
    setErrorMessage(message);
    if (Platform.OS !== 'web') {
      showPlatformAlert(t('common.error'), message);
    }
  };

  useEffect(() => {
    if (!visible) return;
    const initial = buildInitialState();
    setUri(initial.uri);
    setDescription(initial.description);
    setHasIssue(initial.hasIssue);
    setIssueDescription(initial.issueDescription);
    setErrorMessage(null);
  }, [visible, existingPhoto, originalPhoto]);

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showError(t('photos.cameraPermissionRequired'));
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setUri(result.assets[0].uri);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setErrorMessage(null);
      setUri(result.assets[0].uri);
    }
  };

  const handleSave = () => {
    if (!uri) {
      showError(t('photos.takePhoto'));
      return;
    }
    if (showIssueFields && hasIssue && !issueDescription.trim()) {
      showError(t('return.issueDescriptionRequired'));
      return;
    }
    setErrorMessage(null);
    const currentHasIssue = showIssueFields
      ? (hasOriginalIssue ? true : hasIssue)
      : undefined;
    const newIssueDescription = showIssueFields
      ? (hasIssue ? issueDescription.trim() : '')
      : undefined;
    const currentIssueDescription = showIssueFields && currentHasIssue
      ? (
        hasOriginalIssue
          ? mergeIssueDescriptions(originalPhoto?.issueDescription, newIssueDescription)
          : issueDescription.trim()
      )
      : undefined;

    onSave({
      uri,
      position,
      description: description.trim(),
      hasIssue: currentHasIssue,
      hasNewIssue: showIssueFields ? hasIssue : undefined,
      issueDescription: currentIssueDescription,
      newIssueDescription,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            accessible
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="close" size={28} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t(POSITION_LABELS[position])}</Text>
          <TouchableOpacity
            onPress={handleSave}
            accessibilityRole="button"
            accessible
            accessibilityLabel={t('common.save')}
          >
            <Text style={styles.saveText}>{t('common.save')}</Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === 'web' && errorMessage ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {originalPhoto && (
          <View style={[styles.originalSection, originalPhoto.hasIssue && styles.originalSectionIssue]}>
            <Text style={styles.sectionLabel}>{t('return.original')}:</Text>
            <Image source={{ uri: originalPhoto.uri }} style={styles.originalImage} />
            {originalPhoto.hasIssue && originalPhoto.issueDescription ? (
              <>
                <Text style={styles.referenceLabel}>{t('return.existingIssueReference')}</Text>
                <Text style={styles.originalIssueDesc}>{originalPhoto.issueDescription}</Text>
              </>
            ) : originalPhoto.description ? (
              <Text style={styles.originalDesc}>{originalPhoto.description}</Text>
            ) : null}
          </View>
        )}

        <View style={styles.photoSection}>
          {uri ? (
            <Image source={{ uri }} style={styles.preview} />
          ) : (
            <View style={styles.placeholder}>
              <Ionicons name="camera" size={48} color={Colors.gray400} />
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={takePhoto}
            accessibilityRole="button"
            accessible
            accessibilityLabel={t('photos.takePhoto')}
          >
            <Ionicons name="camera" size={22} color={Colors.white} />
            <Text style={styles.actionText}>{t('photos.takePhoto')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: Colors.secondary }]}
            onPress={pickImage}
            accessibilityRole="button"
            accessible
            accessibilityLabel={t('photos.pickFromGallery')}
          >
            <Ionicons name="images" size={22} color={Colors.white} />
            <Text style={styles.actionText}>{t('photos.pickFromGallery')}</Text>
          </TouchableOpacity>
        </View>

        <TextInput
          style={styles.input}
          placeholder={t('photos.description')}
          placeholderTextColor={Colors.gray400}
          value={description}
          onChangeText={setDescription}
          multiline
        />

        {showIssueFields && (
          <View style={styles.issueSection}>
            <View style={styles.issueToggle}>
              <Text style={styles.issueLabel}>
                {hasOriginalIssue ? t('return.newIssueFound') : t('return.issueFound')}
              </Text>
              <Switch
                value={hasIssue}
                onValueChange={setHasIssue}
                trackColor={{ true: Colors.danger }}
              />
            </View>
            {hasOriginalIssue && (
              <Text style={styles.issueHint}>{t('return.onlyNewIssuesHint')}</Text>
            )}
            {hasIssue && (
              <TextInput
                style={[styles.input, styles.issueInput]}
                placeholder={hasOriginalIssue ? t('return.newIssueDescription') : t('return.issueDescription')}
                placeholderTextColor={Colors.gray400}
                value={issueDescription}
                onChangeText={setIssueDescription}
                multiline
              />
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.white,
    paddingTop: Spacing.xl,
  },
  title: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  saveText: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary },
  originalSection: {
    padding: Spacing.md,
    backgroundColor: Colors.gray100,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  originalSectionIssue: {
    backgroundColor: '#fef2f2',
    borderBottomColor: Colors.danger,
  },
  originalImage: {
    width: '100%',
    height: 120,
    borderRadius: BorderRadius.sm,
    resizeMode: 'cover',
  },
  originalDesc: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  originalIssueDesc: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  referenceLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: Spacing.xs,
  },
  photoSection: { alignItems: 'center', padding: Spacing.md },
  preview: {
    width: '100%',
    height: 220,
    borderRadius: BorderRadius.md,
    resizeMode: 'cover',
  },
  placeholder: {
    width: '100%',
    height: 220,
    borderRadius: BorderRadius.md,
    borderWidth: 2,
    borderColor: Colors.gray300,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.gray50,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  actionText: { color: Colors.white, fontSize: FontSize.sm, fontWeight: '600' },
  input: {
    margin: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sm,
    fontSize: FontSize.md,
    color: Colors.text,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  issueSection: { paddingHorizontal: Spacing.md },
  issueToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.white,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  issueLabel: { fontSize: FontSize.md, fontWeight: '600', color: Colors.danger },
  issueHint: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  issueInput: {
    marginHorizontal: 0,
    marginTop: Spacing.sm,
    borderColor: Colors.danger,
  },
  errorBanner: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: Colors.danger,
    borderRadius: BorderRadius.sm,
  },
  errorText: {
    color: Colors.danger,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
});
