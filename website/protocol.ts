import { isRecord } from '../src/lib/runtime_schema.js';

export const LESSONS = [
  {
    id: 'find',
    number: '01',
    title: 'Find your words',
    query: 'coffee',
    hint: '“coffee” appears more than once. Press Tab to move between whole text blocks. Shift + Tab takes you back.',
    short: 'Search & jump',
    mode: 'text',
  },
  {
    id: 'typo',
    number: '02',
    title: 'Misspell it. Find it.',
    query: 'cofee',
    hint: 'One missing letter? No problem. “cofee” still finds “coffee”. KeyMove uses approximate matches when there are no exact results.',
    short: 'Try a typo',
    mode: 'text',
  },
  {
    id: 'act',
    number: '03',
    title: 'Find it. Do it.',
    query: 'Save this guide',
    hint: 'Press Enter to save the guide, or ↓ to explore its actions. Try “Open the checklist” next to find a link.',
    short: 'Take action',
    mode: 'actions',
  },
] as const;
export type LessonId = (typeof LESSONS)[number]['id'];
export type DemoCommand = { type: 'keymove-demo:lesson'; lesson: LessonId };

export function isDemoCommand(value: unknown): value is DemoCommand {
  return (
    isRecord(value) &&
    value['type'] === 'keymove-demo:lesson' &&
    LESSONS.some(lesson => lesson.id === value['lesson'])
  );
}
