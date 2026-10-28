import React from "react"
import { t } from '../../../i18n';
import { useAtlasSettings } from "../../../keyboard/useMapHotkeys"
import { lightingQualityChoices } from "../../../lighting/lightingQualityChoices"
import type { LightingQualityLevel } from "../../../lighting/lightingQuality"
import { SegmentedControl } from "../primitives/SegmentedControl"

/**
 * How much dynamic lighting asks of this device's graphics, in the lighting tool's menu: one
 * segment per level, each telling on hover what it draws and whom it is for. The choice is this
 * device's (`SettingsService.setLightingQuality`, local storage) and holds for every scene, so it
 * is never disabled with the scene's own lighting.
 */
export function LightingQualitySection(): React.ReactElement | null {
  const settings = useAtlasSettings()
  if (!settings) return null
  const current = settings.getLightingQuality()
  return (
    <div className="atlas-dropdown-section">
      <span className="atlas-dropdown-label">{t('sceneLight.quality')}</span>
      <SegmentedControl<LightingQualityLevel>
        value={current}
        options={lightingQualityChoices(current, settings.isLightingQualityPicked())}
        ariaLabel={t('sceneLight.quality')}
        onChange={(level) => settings.setLightingQuality(level)}
      />
    </div>
  )
}
