/**
 * The Cavern: natural caves, the Underdark and monster lairs. Until its own programme lands its
 * rooms carry no type and are furnished by their architectural roles (`props/roles.ts`), with no
 * seat on the boss arena. Nature builds no ruins.
 */

import type { ThemeDefinition } from './themeTypes';

export const CAVERN: ThemeDefinition = {
  id: 'cavern',
  built: false,
  refuses: [{ tag: 'ruined', reason: 'dungeon.theme.refused.notBuilt' }],
  programme: null,
};
