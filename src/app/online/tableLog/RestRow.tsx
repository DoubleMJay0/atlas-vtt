import type { RestChange, RestEntry } from '../protocol/index.ts';
import { memo, type ReactElement } from 'react';
import { AuthorDisc } from './AuthorDisc.tsx';
import { reactionsFor } from './logAuthors.ts';
import type { ThreadStat } from './logThreads.ts';
import type { RowApi, RowFlags } from './panelTypes.ts';
import { ReactionChips } from './ReactionChips.tsx';
import { RowShell } from './RowShell.tsx';
import { ThreadPill } from './ThreadPill.tsx';

export interface RestRowProps extends Omit<RowFlags, 'editing'> {
  readonly entry: RestEntry;
  readonly time: string;
  readonly thread: ThreadStat | null;
  readonly api: RowApi;
}

/** One change as the row says it: "HP 4 → 18 (2d8+2 = 9)". */
export function restChangeText(change: RestChange): string {
  return `${change.label} ${change.from} → ${change.to}${change.roll === undefined ? '' : ` (${change.roll})`}`;
}

/** A rest the GM's Atlas applied: who rested and which rest, then what it changed and what it could not. */
export const RestRow = memo(function RestRow({ entry, time, thread, api, ...flags }: RestRowProps): ReactElement {
  const reactions = reactionsFor(entry, api.self);
  return (
    <RowShell id={entry.id} className="atlas-online-log__row--shown atlas-online-log__row--rest" reactions={reactions} canEdit={false} canDelete={api.moderator} api={api} editing={false} {...flags}>
      <div className="atlas-online-log__message">
        <AuthorDisc who={entry.who} name={entry.name} size="row" />
        <div className="atlas-online-log__content">
          <div className="atlas-online-log__byline">
            <span className="atlas-online-log__name">{`${entry.character} took a ${entry.button}`}</span>
            <span className="atlas-online-log__time">{time}</span>
          </div>
          <div className="atlas-online-log__rest">
            {entry.changes.length === 0
              ? <span className="atlas-online-log__rest-quiet">Nothing to restore.</span>
              : <span className="atlas-online-log__rest-changes">{entry.changes.map(restChangeText).join(', ')}</span>}
            {entry.skipped !== undefined && <span className="atlas-online-log__rest-quiet">{`Not changed: ${entry.skipped.join(', ')}`}</span>}
          </div>
          <ReactionChips id={entry.id} reactions={reactions} api={api} />
          <ThreadPill stat={thread} onOpen={() => api.openThread(entry.id)} />
        </div>
      </div>
    </RowShell>
  );
});
