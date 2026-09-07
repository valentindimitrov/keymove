import { createRoot } from 'react-dom/client';
import ExtensionErrorBoundary from '../../src/components/extension_error_boundary.js';
import PopupSettings from '../../src/components/popup/popup_settings.js';
import '../../src/content.css';
import '../../src/popup.css';

const container = document.getElementById('keymove-popup-root');

if (container) {
  createRoot(container).render(
    <ExtensionErrorBoundary>
      <PopupSettings />
    </ExtensionErrorBoundary>,
  );
}
