import { useRef, useState } from 'react';

const videos = import.meta.glob<string>('./media/patterns/*.mp4', {
  eager: true,
  query: '?url',
  import: 'default',
});
const posters = import.meta.glob<string>('./media/patterns/*.jpg', {
  eager: true,
  query: '?url',
  import: 'default',
});
const captions = import.meta.glob<string>('./media/patterns/*.vtt', {
  eager: true,
  query: '?url',
  import: 'default',
});

export default function PatternClip({ id, title }: { id: string; title: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <div className="pattern-clip">
      <video
        ref={video}
        controls
        playsInline
        preload="none"
        poster={posters[`./media/patterns/${id}.jpg`]}
        aria-label={`${title}: recorded KeyMove demonstration`}
        onPlay={event => {
          setStarted(true);
          document.querySelectorAll('video').forEach(other => {
            if (other !== event.currentTarget) other.pause();
          });
        }}
        onError={() => setFailed(true)}
      >
        <source src={videos[`./media/patterns/${id}.mp4`]} type="video/mp4" />
        <track
          kind="captions"
          src={captions[`./media/patterns/${id}.vtt`]}
          srcLang="en"
          label="English"
        />
        Your browser cannot play this clip. Follow the steps below to try the pattern.
      </video>
      {!started && !failed && (
        <button
          className="pattern-play"
          type="button"
          aria-label={`Play ${title}`}
          onClick={() => {
            void video.current?.play().catch(() => setFailed(true));
          }}
        >
          <span aria-hidden="true">▶</span> Play clip
        </button>
      )}
      {failed && (
        <p className="pattern-clip-error" role="status">
          The clip could not play. <a href={videos[`./media/patterns/${id}.mp4`]}>Open the video</a>{' '}
          or follow the steps below.
        </p>
      )}
    </div>
  );
}
