import type { CampaignBooks } from '../../../campaigns/players/CampaignBooks';
import { bookIn, withBook } from '../../../campaigns/players/booksFile';
import { mergeBooks, migrateBooks, type LibraryToken } from './bookMigration.ts';
import { EMPTY_BOOK, type BookData, type StoredBook } from './bookStore.ts';

/**
 * Carries the books an older Atlas kept in this device's data into the books file of `campaignId`,
 * a book already in the file staying the file's. Settles once the file is on disk; false when the
 * campaign's file cannot be written, and then nothing is carried over.
 */
export async function carryBooksOver(old: BookData, tokens: readonly LibraryToken[], books: CampaignBooks, campaignId: string): Promise<boolean> {
  const carried = new Map<string, StoredBook>();
  migrateBooks(old, tokens, (characterId, book) => {
    const held = carried.get(characterId);
    carried.set(characterId, held === undefined ? book : mergeBooks(held, book));
  });
  if (carried.size === 0) return true;
  const carry = (stored: Parameters<typeof withBook>[0]): ReturnType<typeof withBook> =>
    [...carried].reduce((file, [characterId, book]) => withBook(file, characterId, mergeBooks(bookIn(file, characterId) ?? EMPTY_BOOK, book)), stored);
  if (!books.change(campaignId, carry)) return false;
  await books.flush();
  return true;
}
