import type { Message } from '../../types';

export const resource = {
  'resource.edit': 'Edit {label}',
  'resource.current': 'Current {label}',
  'resource.max': 'Maximum {label}',
  'resource.changeSelection': {
    one: '{label} of {count} token',
    other: '{label} of {count} tokens',
  },
  'resource.changeSelectionEntry': {
    one: 'Change {label} of {count} token…',
    other: 'Change {label} of {count} tokens…',
  },
  'resource.changeSelectionMenu': {
    one: 'Change values of {count} token',
    other: 'Change values of {count} tokens',
  },
  'resource.changeAmount': 'Change of {label}',
  'resource.changePlaceholder': '−8 or +5',
} as const satisfies Record<string, Message>;
