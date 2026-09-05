import React from 'react';
import { EXTENSION_NAME } from '../extension_identity.js';

type ExtensionErrorBoundaryState = {
  failed: boolean;
};

class ExtensionErrorBoundary extends React.Component<
  React.PropsWithChildren,
  ExtensionErrorBoundaryState
> {
  override state: ExtensionErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ExtensionErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${EXTENSION_NAME} search interface failed: ${message}`);
  }

  retry = () => {
    this.setState({ failed: false });
  };

  override render() {
    if (this.state.failed) {
      return (
        <div className="keymove-error-fallback" role="alert">
          <span>The page search interface stopped.</span>
          <button type="button" onClick={this.retry}>
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ExtensionErrorBoundary;
