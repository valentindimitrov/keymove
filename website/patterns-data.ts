import type { KeyboardShortcutName } from '../src/lib/static_data_schema.js';

type Pattern = {
  id: string;
  title: string;
  description: string;
  sequence: string[];
  shortcuts: KeyboardShortcutName[];
  note?: string;
};
type PatternGroup = { id: string; title: string; description: string; patterns: Pattern[] };

export const patternGroups: PatternGroup[] = [
  {
    id: 'find',
    title: 'Find your way',
    description: 'Start with something you can see on the page.',
    patterns: [
      {
        id: 'jump-to-text',
        title: 'Jump to text',
        description: 'Find a passage without scanning or scrolling through the whole page.',
        sequence: [
          'Open KeyMove and type a visible phrase.',
          'The first matching text block is selected and brought into view.',
        ],
        shortcuts: ['focus_searchbar'],
      },
      {
        id: 'move-between-matches',
        title: 'Move between matches',
        description: 'Step through repeated words or phrases, in either direction.',
        sequence: [
          'Search for a word that appears several times.',
          'Press Tab to move forward, or Shift + Tab to go back.',
        ],
        shortcuts: ['next_match', 'previous_match'],
      },
      {
        id: 'choose-a-suggestion',
        title: 'Choose a suggestion',
        description: 'Jump straight to a numbered result in the suggestion list.',
        sequence: [
          'Search and identify the suggestion you want.',
          'Use its number shortcut to select it and scroll to it.',
        ],
        shortcuts: ['select_listed_match_1'],
        note: 'Selecting a suggestion does not activate it. Press Enter when you want to act.',
      },
      {
        id: 'recover-from-a-typo',
        title: 'Find it despite a typo',
        description: 'Keep moving when a missing letter would otherwise stop your search.',
        sequence: [
          'Type “cofee” instead of “coffee”.',
          'When no exact results exist, KeyMove looks for approximate matches.',
        ],
        shortcuts: [],
        note: 'Search tip: exact matches always take priority.',
      },
    ],
  },
  {
    id: 'act',
    title: 'Turn words into actions',
    description: 'Reach links, buttons, and form controls by their names.',
    patterns: [
      {
        id: 'follow-a-link',
        title: 'Follow a link',
        description: 'Open a destination by searching for the link’s text.',
        sequence: [
          'Find and select the link. Switch to action mode if needed.',
          'Press Enter to open it in the current tab.',
        ],
        shortcuts: ['toggle_search_mode', 'select_match'],
      },
      {
        id: 'activate-a-button',
        title: 'Activate a button',
        description: 'Save, submit, or continue without reaching for the mouse.',
        sequence: [
          'Search for a button such as “Save this guide”.',
          'Select it and press Enter to trigger its action.',
        ],
        shortcuts: ['select_match'],
      },
      {
        id: 'act-through-text',
        title: 'Act through associated text',
        description: 'Use a control’s label to act on the control itself.',
        sequence: [
          'Search for the text associated with a checkbox.',
          'Select the label and press Enter to toggle the checkbox.',
        ],
        shortcuts: ['select_match'],
        note: 'Also applies to supported radio buttons and switches. The text must be associated with the control; proximity alone is not enough.',
      },
      {
        id: 'focus-a-field',
        title: 'Focus a form field',
        description: 'Move from finding a field to filling it in.',
        sequence: [
          'Find a field by its label and select it.',
          'Press Enter to focus the field, then type your answer.',
        ],
        shortcuts: ['select_match'],
      },
      {
        id: 'hand-off-to-widget',
        title: 'Hand control to a widget',
        description: 'Let a dropdown, slider, or editor handle its own keyboard interaction.',
        sequence: [
          'Find the widget and press Enter to focus it.',
          'Use its normal arrow keys or typing controls.',
        ],
        shortcuts: ['select_match'],
        note: 'KeyMove hands over focus; the widget determines which keys it supports.',
      },
      {
        id: 'expand-a-section',
        title: 'Expand a collapsed section',
        description: 'Reveal content behind a disclosure or accordion heading.',
        sequence: [
          'Find the heading or its expand button.',
          'Press Enter to expand it, then search the revealed content.',
        ],
        shortcuts: ['select_match'],
      },
    ],
  },
  {
    id: 'explore',
    title: 'Explore and keep your place',
    description: 'Navigate revealed content and choose where to resume reading.',
    patterns: [
      {
        id: 'reveal-a-menu',
        title: 'Reveal a hover menu',
        description: 'Explore a menu that normally appears when you hover over its trigger.',
        sequence: [
          'Explicitly select the menu trigger with result navigation or a numbered suggestion.',
          'Its supported hover menu opens; search and select an option inside it.',
        ],
        shortcuts: ['next_match', 'select_listed_match_1'],
        note: 'Continue through nested menus in the same way. Hover behavior depends on how the website implements the menu.',
      },
      {
        id: 'navigate-a-dialog',
        title: 'Navigate inside a dialog',
        description: 'Keep searching within the modal you are currently using.',
        sequence: [
          'Open a modal dialog and search for a control inside it.',
          'Activate the control. Close the dialog to resume searching the page.',
        ],
        shortcuts: ['focus_searchbar', 'select_match'],
        note: 'While a modal is active, background-page results stay outside the search scope.',
      },
      {
        id: 'return-to-origin',
        title: 'Explore, then return',
        description: 'Take a detour down the page without losing your starting point.',
        sequence: [
          'Search and jump to a result away from where you started.',
          'Use Return to origin to close KeyMove and restore the original position.',
        ],
        shortcuts: ['return_to_origin'],
      },
      {
        id: 'stay-here',
        title: 'Stay where you landed',
        description: 'Finish a search and continue reading at the result.',
        sequence: [
          'Jump to the passage you want to read.',
          'With the search bar focused, press Escape to close KeyMove and stay there.',
        ],
        shortcuts: ['dismiss_search'],
      },
    ],
  },
  {
    id: 'more',
    title: 'Choose your next step',
    description: 'Copy, focus, and open destinations with more control.',
    patterns: [
      {
        id: 'copy-a-passage',
        title: 'Copy a passage',
        description: 'Copy the complete selected text block without dragging across the page.',
        sequence: ['Select a text result.', 'Copy, then paste the passage where you need it.'],
        shortcuts: ['copy_selected_link'],
        note: 'Use text mode to copy the passage rather than a link address.',
      },
      {
        id: 'copy-a-link',
        title: 'Copy a link’s address',
        description: 'Take a destination with you without opening it.',
        sequence: ['Select a link in action mode.', 'Copy, then paste its full address.'],
        shortcuts: ['toggle_search_mode', 'copy_selected_link'],
      },
      {
        id: 'choose-an-action',
        title: 'Choose another action',
        description: 'See the available actions for the selected result.',
        sequence: [
          'With a result selected and the search bar focused, press Down.',
          'Use Up or Down to choose an action, then Enter to run it.',
        ],
        shortcuts: ['open_action_menu', 'select_match'],
        note: 'Inside the menu, Alt/Option + number runs the numbered action. Left or Escape returns to the unchanged query.',
      },
      {
        id: 'focus-without-activating',
        title: 'Focus without activating',
        description: 'Move keyboard focus to a control while leaving its action untouched.',
        sequence: [
          'Open the selected result’s action menu.',
          'Choose “Focus without activating”, then continue with the page’s keyboard navigation.',
        ],
        shortcuts: ['open_action_menu'],
        note: 'Available for focusable controls. Selecting this action does not click the control.',
      },
      {
        id: 'open-in-new-tab',
        title: 'Open without losing your place',
        description: 'Choose whether to follow a link now or keep it for later.',
        sequence: [
          'Select a link and open it in a background tab to keep reading here.',
          'Use the foreground-tab shortcut when you want to switch to the destination.',
        ],
        shortcuts: ['open_match_in_background_tab', 'open_match_in_foreground_tab'],
        note: 'Requires the installed extension. Modified Enter opens links, not buttons or inputs.',
      },
    ],
  },
];
