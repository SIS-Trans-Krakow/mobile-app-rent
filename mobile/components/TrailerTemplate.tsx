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
  isPreloaded?: boolean;
  preloadedFilePath?: string;
}

interface Props {
  photos: Record<string, ZonePhoto | undefined>;
  onZonePress: (position: PhotoPosition) => void;
  readOnly?: boolean;
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

export const REQUIRED_POSITIONS: PhotoPosition[] = ['front', 'rear', 'left-side', 'right-side'];

export default function TrailerTemplate({ photos, onZonePress, readOnly, onPhotoPress }: Props) {
  const { t } = useTranslation();

  const renderZone = (position: PhotoPosition, style?: object) => {
    const photo = photos[position];
    const hasPhoto = !!photo;
    const hasIssue = photo?.hasIssue;
    const isPreloaded = photo?.isPreloaded;
    const isRequired = REQUIRED_POSITIONS.includes(position);

    const handlePress = () => {
      if (readOnly) {
        if (hasPhoto && onPhotoPress) onPhotoPress(photo!);
      } else {
        onZonePress(position);
      }
    };

    const zoneLabel = t(POSITION_LABELS[position]);
    const zoneA11yLabel = readOnly ? zoneLabel : `${zoneLabel}. ${t('photos.tapZone')}`;

    return (
      <TouchableOpacity
        key={position}
        style={[
          styles.zone,
          isRequired && !hasPhoto && styles.zoneRequired,
          hasPhoto && styles.zoneWithPhoto,
          hasIssue && styles.zoneWithIssue,
          isPreloaded && !hasIssue && styles.zonePreloaded,
          style,
        ]}
        onPress={handlePress}
        disabled={readOnly && !hasPhoto}
        accessibilityRole="button"
        accessible
        accessibilityLabel={zoneA11yLabel}
        accessibilityState={{ disabled: readOnly && !hasPhoto }}
      >
        {hasPhoto ? (
          <Image source={{ uri: photo.uri }} style={styles.zoneImage} />
        ) : (
          <Text style={[styles.zoneText, isRequired && styles.zoneTextRequired]}>
            {t(POSITION_LABELS[position])}
            {isRequired ? ' *' : ''}
          </Text>
        )}
        {hasIssue && <View style={styles.issueBadge}><Text style={styles.issueBadgeText}>!</Text></View>}
        {isPreloaded && !hasIssue && (
          <View style={styles.preloadedBadge}>
            <Text style={styles.preloadedBadgeText}>↩</Text>
          </View>
        )}
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
      {!readOnly && (
        <Text style={styles.requiredHint}>* {t('photos.requiredMarker')}</Text>
      )}

      <View style={styles.trailer}>
        <View style={styles.trailerFrame}>
          <View style={styles.hitch}>
            <View style={styles.hitchStem} />
            <View style={styles.hitchPlate} />
          </View>

          <View style={styles.trailerBody}>
            <View style={styles.capRow}>
              {renderZone('front', styles.wideZone)}
            </View>

            <View style={styles.cornerRow}>
              {renderZone('front-left', styles.cornerZone)}
              <View style={styles.cornerSpacer} />
              {renderZone('front-right', styles.cornerZone)}
            </View>

            <View style={styles.bodyShell}>
              {renderZone('left-side', styles.sideZone)}
              <View style={styles.middleColumn}>
                {renderZone('top', styles.middleZone)}
                {renderZone('interior', styles.middleZone)}
              </View>
              {renderZone('right-side', styles.sideZone)}
            </View>

            <View style={styles.cornerRow}>
              {renderZone('rear-left', styles.cornerZone)}
              <View style={styles.cornerSpacer} />
              {renderZone('rear-right', styles.cornerZone)}
            </View>

            <View style={styles.capRow}>
              {renderZone('rear', styles.wideZone)}
            </View>

            <View style={styles.axleRow} pointerEvents="none">
              <View style={styles.wheel} />
              <View style={styles.wheel} />
              <View style={styles.wheel} />
            </View>
          </View>
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
          accessibilityRole="button"
          accessible={!!onPhotoPress}
          accessibilityLabel={t(POSITION_LABELS[pos as PhotoPosition])}
          accessibilityState={{ disabled: !onPhotoPress }}
        >
          <Image source={{ uri: photo!.uri }} style={styles.thumbSmall} />
          <View style={styles.photoDescContent}>
            <Text style={styles.photoDescLabel}>{t(POSITION_LABELS[pos as PhotoPosition])}</Text>
            {photo!.isPreloaded && (
              <Text style={styles.preloadedLabel}>{t('photos.inheritedFromLastReturn')}</Text>
            )}
            {photo!.hasIssue ? (
              <Text style={styles.issueStatusText}>
                {photo!.isPreloaded ? t('photos.inheritedIssue') : t('photos.newIssue')}
              </Text>
            ) : (
              <Text style={styles.noIssueLabel}>{t('return.noIssues')}</Text>
            )}
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
    marginBottom: Spacing.xs,
  },
  requiredHint: {
    textAlign: 'center',
    color: Colors.primaryDark,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
  trailer: {
    borderWidth: 1,
    borderColor: Colors.gray200,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.gray50,
    marginBottom: Spacing.sm,
  },
  trailerFrame: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
  },
  hitch: {
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  hitchStem: {
    width: 18,
    height: 16,
    backgroundColor: Colors.gray300,
    borderTopLeftRadius: BorderRadius.sm,
    borderTopRightRadius: BorderRadius.sm,
  },
  hitchPlate: {
    width: 56,
    height: 12,
    marginTop: 2,
    backgroundColor: Colors.gray300,
    borderRadius: BorderRadius.full,
  },
  trailerBody: {
    width: '100%',
    borderWidth: 2,
    borderColor: Colors.gray300,
    borderRadius: 24,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  capRow: {
    alignItems: 'center',
    marginVertical: 2,
  },
  cornerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  cornerZone: {
    width: 88,
    height: 60,
  },
  cornerSpacer: {
    flex: 1,
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
  zoneRequired: {
    borderColor: Colors.primaryLight,
    backgroundColor: '#eff6ff',
  },
  zoneWithIssue: {
    borderColor: Colors.danger,
    borderStyle: 'solid',
  },
  zonePreloaded: {
    borderColor: Colors.warning,
    borderStyle: 'solid',
  },
  zoneImage: {
    width: '100%',
    height: '100%',
    borderRadius: BorderRadius.sm - 2,
  },
  zoneText: {
    fontSize: 10,
    color: Colors.gray500,
    textAlign: 'center',
    paddingHorizontal: 2,
    fontWeight: '600',
  },
  zoneTextRequired: {
    color: Colors.primaryDark,
  },
  wideZone: {
    width: 200,
    height: 58,
  },
  sideZone: {
    width: 64,
    height: 168,
  },
  bodyShell: {
    flexDirection: 'row',
    alignItems: 'stretch',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.white,
  },
  middleColumn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xs,
  },
  middleZone: {
    width: '100%',
    maxWidth: 190,
    height: 72,
  },
  axleRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
  wheel: {
    width: 34,
    height: 12,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.gray800,
    opacity: 0.9,
  },
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
  preloadedBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.warning,
    justifyContent: 'center',
    alignItems: 'center',
  },
  preloadedBadgeText: {
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
  issueStatusText: {
    fontSize: FontSize.xs,
    color: Colors.danger,
    fontWeight: '700',
    marginTop: 2,
  },
  noIssueLabel: {
    fontSize: FontSize.xs,
    color: Colors.success,
    fontWeight: '600',
    marginTop: 2,
  },
  preloadedLabel: {
    fontSize: FontSize.xs,
    color: Colors.warning,
    fontWeight: '600',
    marginTop: 2,
  },
});
