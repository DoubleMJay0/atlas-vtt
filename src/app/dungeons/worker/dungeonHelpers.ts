import type { DungeonJob, DungeonRendered } from './dungeonJob';
import { DungeonWorkerClient } from './DungeonWorkerClient';

/**
 * Dungeon workers beside the app's own, for jobs of one task that may run side by side (the
 * shading of a scene's floors). Up to `count` workers start as jobs arrive, which take turns;
 * `dispose` stops them once the task is done.
 */
export class DungeonHelpers {
  private readonly clients: DungeonWorkerClient[] = [];
  private turn = 0;

  constructor(private readonly count: number) {}

  render(job: DungeonJob): Promise<DungeonRendered> {
    const index = this.turn++ % Math.max(1, this.count);
    this.clients[index] ??= DungeonWorkerClient.standalone('Atlas dungeons (helper)');
    return this.clients[index].render(job);
  }

  dispose(): void {
    for (const client of this.clients.splice(0)) client.dispose();
  }
}
