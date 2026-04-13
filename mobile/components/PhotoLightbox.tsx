import React from 'react';
import {
  Modal, View, Image, Text, TouchableOpacity, StyleSheet,
  StatusBar, Platform, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, FontSize, Spacing } from '../constants/theme';

interface Props {
  uri: string | null;
  description?: string;
  label?: string;
  onClose: () => void;
}

export default function PhotoLightbox({ uri, description, label, onClose }: Props) {
  if (!uri) return null;

  return (
    <Modal
      visible={!!uri}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {Platform.OS !== 'web' && <StatusBar hidden />}

        <TouchableOpacity style={styles.closeBtn} onPress={onClose} hitSlop={16}>
          <View style={styles.closeBtnInner}>
            <Ionicons name="close" size={22} color={Colors.white} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.imageArea}
          activeOpacity={1}
          onPress={onClose}
        >
          <Image
            source={{ uri }}
            style={styles.image}
            resizeMode="contain"
          />
        </TouchableOpacity>

        {(label || description) ? (
          <View style={styles.caption}>
            {label ? <Text style={styles.captionLabel}>{label}</Text> : null}
            {description ? <Text style={styles.captionDesc}>{description}</Text> : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 40,
    right: Spacing.md,
    zIndex: 10,
  },
  closeBtnInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageArea: {
    width,
    height: height * 0.78,
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  caption: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? 40 : Spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  captionLabel: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 2,
  },
  captionDesc: {
    fontSize: FontSize.md,
    color: Colors.white,
  },
});
