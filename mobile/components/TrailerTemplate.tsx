import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

export type PhotoPosition =
  | 'front'
  | 'rear'
  | 'left-side'
  | 'right-side'
  | 'top'
  | 'interior'
  | 'front-left'
  | 'front-right'
  | 'rear-left'
  | 'rear-right';

export interface ZonePhoto {
  uri: string;
  position: PhotoPosition;
  description: string;
  hasIssue?: boolean;
  issueDescription?: string;
}

interface Props {
  photos: Record<string, ZonePhoto | undefined>;
  onZonePress: (position: PhotoPosition) => void;
  readOnly?: boolean;
  originalPhotos?: Record<string, ZonePhoto | undefined>;
  onPhotoPress?: (photo: ZonePhoto) => void;
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

export const ALL_POSITIONS: PhotoPosition[] = [
  'front', 'rear', 'left-side', 'right-side',
  'top', 'interior', 'front-left', 'front-right',
  'rear-left', 'rear-right',
];

export default function TrailerTemplate({ photos, onZonePress, readOnly, originalPhotos, onPhotoPress }: Props) {
  const { t } = useTranslation();

  const renderZone = (position: PhotoPosition, style?: object) => {
    const photo = photos[position];
    const hasPhoto = !!photo;
    const hasIssue = photo?.hasIssue;

    const handlePress = () => {
      if (readOnly) {
        if (hasPhoto && onPhotoPress) onPhotoPress(photo!);
      } else {
        onZonePress(position);
      }
    };

    return (
      <TouchableOpacity
        key={position}
        style={[
          styles.zone,
          hasPhoto && styles.zoneWithPhoto,
          hasIssue && styles.zoneWithIssue,
          style,
        ]}
        onPress={handlePress}
        disabled={readOnly && !hasPhoto}
      >
        {hasPhoto ? (
          <Image source={{ uri: photo.uri }} style={styles.zoneImage} />
        ) : (
          <Text style={styles.zoneText}>{t(POSITION_LABELS[position])}</Text>
        )}
        {hasIssue && <View style={styles.issueBadge}><Text style={styles.issueBadgeText}>!</Text></View>}
        {readOnly && hasPhoto && (
          <View style={styles.zoomHint}>
            <Text style={styles.zoomHintText}>🔍</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.hint}>
        {readOnly ? '' : t('photos.tapZone')}
      </Text>

      <View style={styles.trailer}>
        {/* Front row */}
        <View style={styles.row}>
          <View style={styles.cornerSpace} />
          {renderZone('front', styles.wideZone)}
          <View style={styles.cornerSpace} />
        </View>

        {/* Front corners */}
        <View style={styles.row}>
          {renderZone('front-left')}
          <View style={styles.spacer} />
          {renderZone('front-right')}
        </View>

        {/* Middle: left, top/interior, right */}
        <View style={styles.row}>
          {renderZone('left-side', styles.sideZone)}
          <View style={styles.middleColumn}>
            {renderZone('top', styles.middleZone)}
            {renderZone('interior', styles.middleZone)}
          </View>
          {renderZone('right-side', styles.sideZone)}
        </View>

        {/* Rear corners */}
        <View style={styles.row}>
          {renderZone('rear-left')}
          <View style={styles.spacer} />
          {renderZone('rear-right')}
        </View>

        {/* Rear row */}
        <View style={styles.row}>
          <View style={styles.cornerSpace} />
          {renderZone('rear', styles.wideZone)}
          <View style={styles.cornerSpace} />
        </View>
      </View>

      {/* Photo descriptions list */}
      {Object.entries(photos).filter(([_, v]) => v).map(([pos, photo]) => (
        <TouchableOpacity
          key={pos}
          style={styles.photoDesc}
          onPress={() => onPhotoPress && onPhotoPress(photo!)}
          disabled={!onPhotoPress}
          activeOpacity={onPhotoPress ? 0.7 : 1}
        >
          <Image source={{ uri: photo!.uri }} style={styles.thumbSmall} />
          <View style={styles.photoDescContent}>
            <Text style={styles.photoDescLabel}>{t(POSITION_LABELS[pos as PhotoPosition])}</Text>
            {photo!.description ? <Text style={styles.photoDescText}>{photo!.description}</Text> : null}
            {photo!.hasIssue && (
              <Text style={styles.issueText}>{photo!.issueDescription}</Text>
            )}
          </View>
          {onPhotoPress && (
            <Ionicons name="expand-outline" size={18} color={Colors.gray400} style={{ alignSelf: 'center' }} />
          )}
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: Spacing.md },
  hint: {
    textAlign: 'center',
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
  },
  trailer: {
    borderWidth: 2,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    backgroundColor: Colors.gray50,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 2,
  },
  zone: {
    width: 72,
    height: 72,
    borderWidth: 2,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.sm,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
    backgroundColor: Colors.white,
    overflow: 'hidden',
  },
  zoneWithPhoto: {
    borderColor: Colors.success,
    borderStyle: 'solid',
  },
  zoneWithIssue: {
    borderColor: Colors.danger,
    borderStyle: 'solid',
  },
  zoneImage: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.sm - 2,
  },
  zoneText: {
    fontSize: 9,
    color: Colors.gray500,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  wideZone: {
    width: 160,
    height: 56,
  },
  sideZone: {
    width: 56,
    height: 140,
  },
  middleColumn: {
    flex: 1,
    alignItems: 'center',
  },
  middleZone: {
    width: 140,
    height: 66,
  },
  spacer: { flex: 1 },
  cornerSpace: { width: 76 },
  issueBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.danger,
    justifyContent: 'center',
    alignItems: 'center',
  },
  issueBadgeText: {
    color: Colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  zoomHint: {
    position: 'absolute',
    bottom: 2,
    right: 2,
  },
  zoomHintText: {
    fontSize: 10,
  },
  photoDesc: {
    flexDirection: 'row',
    padding: Spacing.sm,
    marginTop: Spacing.sm,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  thumbSmall: {
    width: 60,
    height: 60,
    borderRadius: BorderRadius.sm,
  },
  photoDescContent: {
    flex: 1,
    marginLeft: Spacing.sm,
  },
  photoDescLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  photoDescText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  issueText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    fontWeight: '600',
    marginTop: 2,
  },
});
