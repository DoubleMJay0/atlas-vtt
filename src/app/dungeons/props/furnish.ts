/** What stands on the platform of a boss arena: its climax type's seat. */

import type { PropKind } from '../model';
import type { ArenaSpec } from '../themes/themeTypes';

/** What stands on the boss arena's platform: its climax type's seat; none without one, so no arena has a throne by default. */
export function arenaSeat(arena?: ArenaSpec): PropKind | null {
  return arena?.seat ?? null;
}
