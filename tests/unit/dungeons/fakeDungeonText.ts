import type { PropKind } from '../../../src/app/dungeons/model';
import type { DungeonTag } from '../../../src/app/dungeons/tags';
import type { DungeonText, NoteText, RoomPlan, StoryContext } from '../../../src/app/dungeons/text/contract';

const PROPS: readonly PropKind[] = ['chest', 'statue', 'altar', 'well', 'tapestry', 'crate'];

export interface RecordingText extends DungeonText {
  /** The plans the last `writeNotes` was given. */
  plans: readonly RoomPlan[];
}

/** A stand-in for the text module: says what each plan holds, in words chosen by `wording`. */
export function fakeDungeonText(wording = 'A'): RecordingText {
  const text: RecordingText = {
    plans: [],
    nameDungeon(seed: number, tags: readonly DungeonTag[], name?: string): StoryContext {
      return {
        title: name ?? `${wording} Keep ${seed}`,
        story: `${wording} story.`,
        tags: [...tags],
        boss: 'the Test Boss',
        placeNoun: 'keep',
        keyLook: 'brass',
        facts: {},
      };
    },
    writeNotes(_seed: number, _story: StoryContext, plans: readonly RoomPlan[]): NoteText[] {
      text.plans = plans;
      return plans
        .filter((plan) => plan.features.length > 0)
        .map((plan) => ({
          room: plan.room,
          text: `${wording}: ${plan.features.map((f) => f.kind).join(', ')}.`,
          props: plan.features.some((f) => f.kind === 'loot') ? [PROPS[plan.room % PROPS.length] as PropKind] : [],
          water: plan.room % 7 === 3,
          rubble: plan.room % 4 === 1,
        }));
    },
  };
  return text;
}
