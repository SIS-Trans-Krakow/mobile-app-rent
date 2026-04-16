import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
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
  newIssueDescription?: string;
  hasNewIssue?: boolean;
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

const ZONE_LAYOUTS: Record<PhotoPosition, ViewStyle> = {
  'front': { left: '31%', top: '6%', width: '38%', height: '7.5%' },
  'front-left': { left: '17%', top: '18%', width: '14%', height: '12%' },
  'front-right': { right: '17%', top: '18%', width: '14%', height: '12%' },
  'left-side': { left: '14%', top: '31%', width: '12%', height: '36%' },
  'right-side': { right: '14%', top: '31%', width: '12%', height: '36%' },
  'top': { left: '31%', top: '18%', width: '38%', height: '13%' },
  'interior': { left: '29%', top: '36%', width: '42%', height: '27%' },
  'rear-left': { left: '17%', bottom: '14%', width: '14%', height: '12%' },
  'rear-right': { right: '17%', bottom: '14%', width: '14%', height: '12%' },
  'rear': { left: '31%', bottom: '5%', width: '38%', height: '7.5%' },
};

export default function TrailerTemplate({ photos, onZonePress, readOnly, onPhotoPress }: Props) {
  const { t } = useTranslation();

  const renderZone = (position: PhotoPosition, style?: ViewStyle) => {
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
        <View style={styles.diagramFrame}>
          <Text style={styles.directionLabel}>{t('photos.front')}</Text>

          <View style={styles.diagramCanvas}>
            <Svg width="100%" height="100%" viewBox="0 0 300 470" style={styles.diagramSvg}>
              <Rect x="106" y="24" width="88" height="18" rx="2" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Rect x="136" y="8" width="28" height="10" rx="2" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Line x1="150" y1="18" x2="150" y2="24" stroke={Colors.gray800} strokeWidth="3" />

              <Rect x="70" y="52" width="160" height="346" rx="4" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Rect x="80" y="64" width="140" height="36" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Rect x="80" y="108" width="140" height="76" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Rect x="80" y="192" width="140" height="126" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Rect x="80" y="326" width="140" height="48" fill="none" stroke={Colors.gray800} strokeWidth="3" />

              <Line x1="96" y1="52" x2="96" y2="398" stroke={Colors.gray800} strokeWidth="3" />
              <Line x1="204" y1="52" x2="204" y2="398" stroke={Colors.gray800} strokeWidth="3" />

              <Rect x="84" y="320" width="10" height="58" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Rect x="206" y="320" width="10" height="58" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Line x1="79" y1="378" x2="99" y2="378" stroke={Colors.gray800} strokeWidth="3" />
              <Line x1="201" y1="378" x2="221" y2="378" stroke={Colors.gray800} strokeWidth="3" />

              <Line x1="70" y1="146" x2="54" y2="146" stroke={Colors.gray800} strokeWidth="3" />
              <Line x1="70" y1="292" x2="54" y2="292" stroke={Colors.gray800} strokeWidth="3" />
              <Line x1="230" y1="146" x2="246" y2="146" stroke={Colors.gray800} strokeWidth="3" />
              <Line x1="230" y1="292" x2="246" y2="292" stroke={Colors.gray800} strokeWidth="3" />
              <Rect x="48" y="132" width="6" height="28" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Rect x="48" y="278" width="6" height="28" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Rect x="246" y="132" width="6" height="28" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Rect x="246" y="278" width="6" height="28" fill="none" stroke={Colors.gray800} strokeWidth="3" />

              <Circle cx="58" cy="320" r="10" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Circle cx="58" cy="350" r="10" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Circle cx="58" cy="380" r="10" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Circle cx="242" cy="320" r="10" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Circle cx="242" cy="350" r="10" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Circle cx="242" cy="380" r="10" fill="none" stroke={Colors.gray800} strokeWidth="3" />

              <Rect x="86" y="406" width="128" height="24" fill="none" stroke={Colors.gray800} strokeWidth="3" />
              <Line x1="150" y1="406" x2="150" y2="430" stroke={Colors.gray800} strokeWidth="3" />
              <Line x1="126" y1="412" x2="126" y2="424" stroke={Colors.gray800} strokeWidth="3" />
              <Line x1="174" y1="412" x2="174" y2="424" stroke={Colors.gray800} strokeWidth="3" />
            </Svg>

            {renderZone('front', ZONE_LAYOUTS['front'])}
            {renderZone('front-left', ZONE_LAYOUTS['front-left'])}
            {renderZone('front-right', ZONE_LAYOUTS['front-right'])}
            {renderZone('left-side', ZONE_LAYOUTS['left-side'])}
            {renderZone('right-side', ZONE_LAYOUTS['right-side'])}
            {renderZone('top', ZONE_LAYOUTS['top'])}
            {renderZone('interior', ZONE_LAYOUTS['interior'])}
            {renderZone('rear-left', ZONE_LAYOUTS['rear-left'])}
            {renderZone('rear-right', ZONE_LAYOUTS['rear-right'])}
            {renderZone('rear', ZONE_LAYOUTS['rear'])}
          </View>

          <Text style={styles.directionLabel}>{t('photos.rear')}</Text>
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
  diagramFrame: {
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    alignItems: 'center',
  },
  directionLabel: {
    fontSize: 18,
    fontStyle: 'italic',
    color: Colors.gray700,
    marginVertical: Spacing.sm,
  },
  diagramCanvas: {
    width: '100%',
    aspectRatio: 300 / 430,
    position: 'relative',
    backgroundColor: Colors.white,
  },
  diagramSvg: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  zone: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: Colors.gray300,
    borderRadius: BorderRadius.sm,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  zoneWithPhoto: {
    borderColor: Colors.success,
    borderStyle: 'solid',
    backgroundColor: Colors.white,
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
    fontSize: 11,
    color: Colors.gray500,
    textAlign: 'center',
    fontWeight: '600',
  },
  zoneTextRequired: {
    color: Colors.primaryDark,
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
