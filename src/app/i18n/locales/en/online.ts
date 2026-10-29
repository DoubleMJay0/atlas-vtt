import type { Message } from '../../types';

export const online = {
  'online.assetsQuota': 'Your shared copies for players are full. New files reach players from this Obsidian while it runs; remove shared copies in the table panel to make room.',
  'online.assetsRestricted': 'This account cannot share files with players right now.',
  'online.assetsMapTooLarge': 'This map is too large to share with players yet.',
  'online.mapUnreadable': 'This scene\'s map image cannot be sent to players.',
  'online.assetsFailed': 'A file could not be shared with players.',
  'online.sharedUsage': 'Shared with players: {used} of {quota}',
  'online.sharedUsageLeaves': {
    one: 'Shared with players: {used} of {quota}, oldest leaves in {count} day',
    other: 'Shared with players: {used} of {quota}, oldest leaves in {count} days',
  },
  'online.sharedUsageToday': 'Shared with players: {used} of {quota}, oldest leaves today',
  'online.sharedUnknown': 'Shared copies for players cannot be checked right now',
  'online.removeShared': 'Remove shared copies now',
  'online.removeSharedTitle': 'Remove shared copies',
  'online.removeSharedQuestion': 'Remove every copy kept for your players? Files the table still shows are shared again.',
  'online.removeSharedAction': 'Remove',
  'online.removedShared': 'Shared copies removed.',
  'online.removeSharedFailed': 'Shared copies could not be removed. Try again later.',
  'online.deleteOnSignOut': 'Delete shared copies on sign-out',
  'online.deleteOnSignOutDesc': 'Removes the files kept for your players when this device signs out.',
} as const satisfies Record<string, Message>;
