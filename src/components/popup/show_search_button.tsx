import React from 'react';

export default function ShowSearchButton({
  onShow,
  unavailable,
}: {
  onShow: () => Promise<void>;
  unavailable: string | null;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const descriptionId = React.useId();
  return (
    <div className="keymove-show-search">
      <button
        type="button"
        className="keymove-settings-button keymove-show-search-button"
        disabled={busy || !!unavailable}
        aria-describedby={unavailable || error ? descriptionId : undefined}
        onClick={() => {
          setBusy(true);
          setError(null);
          void onShow()
            .catch((reason: unknown) => {
              setError(
                reason instanceof Error ? reason.message : 'Could not open KeyMove. Try again.',
              );
            })
            .finally(() => setBusy(false));
        }}
      >
        {busy ? 'Opening…' : 'Show KeyMove search bar'}
      </button>
      {(unavailable || error) && (
        <p id={descriptionId} className="keymove-popup-hint" role={error ? 'alert' : undefined}>
          {unavailable || error}
        </p>
      )}
    </div>
  );
}
