import type { HighlightColors } from '../../lib/highlight_colors_schema.js';
import type { SearchMode } from '../../hooks/use_search_navigation.js';

type SettingsControls = {
  autoHide: boolean;
  toggleAutoHide: () => void;
  alwaysOn: boolean;
  toggleAlwaysOn: () => void;
  startInActionMode: boolean;
  toggleStartInActionMode: () => void;
  highlightMatches: boolean;
  toggleHighlightMatches: () => void;
  showAutohideButton: boolean;
  toggleShowAutohideButton: () => void;
  highlightColors: HighlightColors;
  updateHighlightColor: (mode: SearchMode, color: string) => void;
  resetHighlightColors: () => void;
};

export type { SettingsControls };
