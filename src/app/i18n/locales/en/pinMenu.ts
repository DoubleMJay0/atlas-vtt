import type { Message } from '../../types';

export const pinMenu = {
  'pinMenu.open': 'Open Note',
  'pinMenu.edit': 'Edit Pin',
  'pinMenu.rollEncounter': 'Roll Encounter',
  'pinMenu.readable': 'Readable by players',
} as const satisfies Record<string, Message>;
