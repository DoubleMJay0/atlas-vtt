import React, { useState } from 'react';
import { cn } from '../../../../utils/cn';
import { useScrollbarGutter } from '../../../packages/components/primitives/useScrollbarGutter';

interface SettingsContentProps {
  /** The tab takes the whole width (the Resources tab beside its recovery pane); a form keeps a readable width, centred. */
  wide?: boolean;
  children: React.ReactNode;
}

/**
 * The scrolling area of the collection settings dialog that holds the open tab.
 * Its scrollbar lies inside the padding, so a tab that starts to scroll does not move.
 */
export function SettingsContent({ wide = false, children }: SettingsContentProps): React.ReactElement {
  const [content, setContent] = useState<HTMLDivElement | null>(null);
  useScrollbarGutter(content);
  return (
    <div ref={setContent} className="atlas-collection-settings-content">
      <div className={cn('atlas-collection-settings-page', wide && 'atlas-collection-settings-page--wide')}>{children}</div>
    </div>
  );
}
