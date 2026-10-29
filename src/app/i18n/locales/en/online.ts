import type { Message } from '../../types';

export const online = {
  'online.assetsRestricted': 'This account cannot share files with players right now.',
  'online.assetsMapTooLarge': 'This map is too large to share with players.',
  'online.mapUnreadable': 'This scene\'s map image cannot be sent to players.',
  'online.assetsFailed': 'A file could not be shared with players.',
} as const satisfies Record<string, Message>;
