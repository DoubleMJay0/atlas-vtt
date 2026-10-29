import { TEXT_MIME_TYPE, type AssetRef, type BookQuest, type QuestImage } from '../../protocol/index.ts';
import { ASSET_USES, type AssetStoring } from '../assets/assetUses.ts';
import type { QuestAsset } from './questGate.ts';

/**
 * The quests as players are sent them with the ids the store keeps their whole texts and images
 * under. Atlas hands quests on by hash alone (`QuestHandouts`); here each reference whose source the
 * quest gate names gains its id, the text from its bytes, an image from its vault file. A quest whose
 * references all gained theirs is kept by identity, so books still compare quests that way; one that
 * gained none (no salt yet) is handed on as it came.
 */
export class StoredQuests {
  private readonly done = new WeakMap<BookQuest, BookQuest>();

  constructor(private readonly stored: AssetStoring, private readonly assetOf: (hash: string) => QuestAsset | undefined) {}

  async of(quests: readonly BookQuest[]): Promise<readonly BookQuest[]> {
    const made = await Promise.all(quests.map((quest) => this.quest(quest)));
    return made.every((quest, index) => quest === quests[index]) ? quests : made;
  }

  private async quest(quest: BookQuest): Promise<BookQuest> {
    const known = this.done.get(quest);
    if (known !== undefined) return known;
    const text = quest.text === undefined ? undefined : await this.ref(quest.text, 'text');
    const images = quest.images === undefined ? undefined : await Promise.all(quest.images.map(async (image): Promise<QuestImage> => ({ ...image, image: await this.ref(image.image, 'image') })));
    const refs = [...(text === undefined ? [] : [text]), ...(images ?? []).map((image) => image.image)];
    if (refs.length === 0 || refs.some((ref) => ref.id === undefined)) return quest;
    const made: BookQuest = { ...quest, ...(text !== undefined && { text }), ...(images !== undefined && { images }) };
    this.done.set(quest, made);
    return made;
  }

  private ref(ref: AssetRef, use: 'text' | 'image'): Promise<AssetRef> {
    return storedRefOf(this.stored, ref, ref.id === undefined ? this.assetOf(ref.hash) : undefined, use);
  }
}

/**
 * A reference handed on by hash, with the id the store keeps it under where its source is known (a
 * text's bytes, an image's vault file) and the store keeps it; else as it came. A file changed since
 * the reference was made keeps the reference as it was.
 */
export async function storedRefOf(stored: AssetStoring, ref: AssetRef, source: QuestAsset | undefined, use: 'text' | 'image'): Promise<AssetRef> {
  if (ref.id !== undefined || source === undefined) return ref;
  const made = 'bytes' in source
    ? await stored.refOf(source.bytes, use === 'text' ? TEXT_MIME_TYPE : ref.mime, ASSET_USES[use])
    : await stored.fileRef(source.path, ref.mime, ASSET_USES[use]).catch(() => null);
  return made !== null && made.hash === ref.hash && made.id !== undefined ? made : ref;
}
