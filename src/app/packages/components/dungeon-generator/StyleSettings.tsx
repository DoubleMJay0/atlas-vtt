import React, { useState } from 'react';
import { StyleGallery, useThumbnailSize } from './StyleGallery';
import type { DungeonState } from './useDungeonState';
import { useStyleThumbnails, type ThumbnailRenderer } from './useStyleThumbnails';

interface StyleSettingsProps {
  state: DungeonState;
  renderer: ThumbnailRenderer;
}

/** How the dungeon is drawn: one of the looks, each shown on the dungeon as it is. */
export function StyleSettings({ state, renderer }: StyleSettingsProps): React.JSX.Element {
  const [art, setArt] = useState<HTMLSpanElement | null>(null);
  const size = useThumbnailSize(art);
  const { settings } = state;
  const thumbnails = useStyleThumbnails(renderer, {
    request: state.request,
    model: state.model,
    view: settings.view,
    size,
    first: settings.style,
  });
  return <StyleGallery value={settings.style} thumbnails={thumbnails} onChange={state.setStyle} onArt={setArt} />;
}
