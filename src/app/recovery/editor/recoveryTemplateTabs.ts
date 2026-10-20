/**
 * The templates the recovery editor offers a tab for: those the collection's statblock roles start
 * from, those its player characters' notes are drawn with, and those it keeps buttons for. Pure.
 */

import type { StatblockRole } from '../../statblocks/model/roleTypes';
import type { TemplateId } from '../../statblocks/model/templateTypes';

export interface RecoveryTemplateTab {
  templateId: TemplateId;
  /** The roles that start from it ("Player character · NPC"), else the template's own name. */
  label: string;
}

/** Joins role names on one tab. */
export const ROLE_SEPARATOR = ' · ';

/**
 * One tab per template, in order: the roles' templates in role order, then the player characters'
 * and the ones with buttons that no role names. A template `nameOf` cannot find has no tab.
 */
export function recoveryTemplateTabs(
  roles: readonly StatblockRole[],
  others: readonly TemplateId[],
  nameOf: (id: TemplateId) => string | null,
): RecoveryTemplateTab[] {
  const roleNames = new Map<TemplateId, string[]>();
  for (const role of roles) {
    const name = role.name.trim();
    if (!name) continue;
    roleNames.set(role.templateId, [...(roleNames.get(role.templateId) ?? []), name]);
  }
  const ids = [...new Set([...roleNames.keys(), ...others])];
  return ids.flatMap((templateId) => {
    const name = nameOf(templateId);
    if (name === null) return [];
    const named = roleNames.get(templateId);
    return [{ templateId, label: named ? [...new Set(named)].join(ROLE_SEPARATOR) : name }];
  });
}
