import { t } from '../i18n';
import { LIGHTING_QUALITY_LEVELS, type LightingQualityLevel } from './lightingQuality';

/** One level as the lighting menu offers it: its name and, on hover, what it draws and whom it is for. */
export interface LightingQualityChoice {
  readonly value: LightingQualityLevel;
  readonly label: string;
  readonly hint: string;
}

const LABELS: Record<LightingQualityLevel, () => string> = {
  high: () => t('sceneLight.qualityHigh'),
  balanced: () => t('sceneLight.qualityBalanced'),
  saver: () => t('sceneLight.qualitySaver'),
};

const HINTS: Record<LightingQualityLevel, () => string> = {
  high: () => t('sceneLight.qualityHighHint'),
  balanced: () => t('sceneLight.qualityBalancedHint'),
  saver: () => t('sceneLight.qualitySaverHint'),
};

/**
 * The three levels for the lighting menu's choice. The level in effect says, where Atlas picked it
 * for this device's graphics (`SettingsService.isLightingQualityPicked`), that it did.
 */
export function lightingQualityChoices(current: LightingQualityLevel, picked: boolean): LightingQualityChoice[] {
  return LIGHTING_QUALITY_LEVELS.map((value) => {
    const hint = HINTS[value]();
    return { value, label: LABELS[value](), hint: picked && value === current ? t('sceneLight.qualityPicked', { hint }) : hint };
  });
}
