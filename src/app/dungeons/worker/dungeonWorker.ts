import { installDungeonFonts, type FontSetLike } from '../render/fonts';
import { runDungeonJob, type DungeonWorkerMessage, type DungeonWorkerReply, type FontLoader } from './dungeonJob';

/**
 * Entry of the dungeon worker that `DungeonWorkerClient` runs, bundled inline into main.js by
 * Vite. A worker has no stylesheet, so the window sends the bundled faces first, and every job
 * waits until they are installed. Jobs run one at a time, in the order they arrive.
 */

/** A worker's font set: `self.fonts`, which the window's typings do not name. */
const fonts = (self as unknown as { fonts: FontSetLike & FontLoader }).fonts;

let installed: Promise<void> = Promise.resolve();

function reply(response: DungeonWorkerReply): void {
  const transfer = response.ok && response.result.image.type === 'bitmap' ? [response.result.image.bitmap] : [];
  self.postMessage(response, { transfer });
}

self.addEventListener('message', (event: MessageEvent<DungeonWorkerMessage>) => {
  const message = event.data;
  if (message.type === 'fonts') {
    // A face that cannot load leaves the fallback faces; the dungeon is still drawn
    installed = installDungeonFonts(fonts, message.fonts).catch((error: unknown) => console.warn('[Atlas] The dungeon fonts could not be loaded', error));
    return;
  }
  const { id, job } = message;
  installed
    .then(() => runDungeonJob(job, fonts))
    .then(
      (result) => reply({ id, ok: true, result }),
      (error: unknown) => reply({ id, ok: false, message: error instanceof Error ? error.message : 'Could not draw the dungeon.' }),
    );
});
