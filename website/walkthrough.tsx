import { useRef, useState } from 'react';
import Shortcut from './shortcut.js';
import recording from './media/walkthrough.mp4';
import poster from './media/walkthrough-poster.jpg';
import captions from './media/walkthrough.vtt?url';
import './walkthrough.css';

const steps = [
  {
    time: 0,
    title: 'Open KeyMove',
    detail: 'Bring the search bar into focus.',
    shortcut: 'focus_searchbar',
  },
  {
    time: 2,
    title: 'Type what you see',
    detail: '“coffee” finds matching text on the page.',
    text: 'coffee',
  },
  {
    time: 6,
    title: 'Jump between matches',
    detail: 'Each press of Tab selects the next complete text block.',
    shortcut: 'next_match',
  },
  {
    time: 12,
    title: 'Clear the search',
    detail: 'Escape clears the query, ready for your next move.',
    shortcut: 'dismiss_search',
  },
  {
    time: 12.5,
    title: 'Focus the search bar',
    detail: 'Bring the search bar back into focus.',
    shortcut: 'focus_searchbar',
  },
  {
    time: 13,
    title: 'Switch to actions',
    detail: 'Search links, buttons, and other controls.',
    shortcut: 'toggle_search_mode',
  },
  {
    time: 14,
    title: 'Find a button',
    detail: 'Type the button’s name: “Save this guide”.',
    text: 'Save this guide',
  },
  {
    time: 20,
    title: 'Make it happen',
    detail: 'Enter activates the selected button. The guide is saved.',
    shortcut: 'select_match',
  },
] as const;

const chapters = [
  { time: 0, label: 'Open & search' },
  { time: 6, label: 'Move through the page' },
  { time: 12, label: 'Find & activate a button' },
] as const;

export default function Walkthrough() {
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const step = steps.findLast(item => time >= item.time) ?? steps[0];

  function seek(seconds: number, pause = false) {
    const player = video.current;
    if (!player || !Number.isFinite(player.duration)) return;
    if (pause) player.pause();
    player.currentTime = Math.max(0, Math.min(player.duration, seconds));
    setTime(player.currentTime);
  }

  return (
    <section className="walkthrough wrap" aria-labelledby="walkthrough-title">
      <div className="section-heading">
        <div>
          <span className="eyebrow">WATCH IT WORK</span>
          <h2 id="walkthrough-title">From a word to an action, in 24 seconds.</h2>
        </div>
      </div>
      <div className="walkthrough-player">
        <div className="walkthrough-screen">
          <video
            ref={video}
            controls
            playsInline
            preload="metadata"
            poster={poster}
            aria-label="KeyMove walkthrough: search, navigate, and activate a button"
            aria-describedby="walkthrough-help"
            onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
            onSeeked={event => setTime(event.currentTarget.currentTime)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)}
            onError={() => setFailed(true)}
          >
            <source src={recording} type="video/mp4" />
            <track kind="captions" src={captions} srcLang="en" label="English walkthrough" />
            Your browser cannot play this video. Try the interactive demo below.
          </video>
          {failed && (
            <p role="status">
              The recording could not load. <a href="#playground">Try the live demo below.</a>
            </p>
          )}
          <div className="walkthrough-transport" role="group" aria-label="Walkthrough playback">
            <button
              type="button"
              onClick={() => {
                const player = video.current;
                if (!player) return;
                if (player.paused) void player.play().catch(() => setFailed(true));
                else player.pause();
              }}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <button type="button" onClick={() => seek(0, true)}>
              Restart
            </button>
            <button type="button" onClick={() => seek((video.current?.currentTime ?? 0) - 5)}>
              Back 5 seconds
            </button>
            <span>24 sec · No audio</span>
          </div>
        </div>
        <aside className="walkthrough-guide" aria-label="Walkthrough guide">
          <div className="walkthrough-caption" aria-live="polite" aria-atomic="true">
            <span className="eyebrow">ON THE KEYBOARD</span>
            <div className="walkthrough-keys">
              {'shortcut' in step ? <Shortcut name={step.shortcut} /> : <kbd>{step.text}</kbd>}
            </div>
            <h3>{step.title}</h3>
            <p>{step.detail}</p>
          </div>
          <div className="walkthrough-chapters" role="group" aria-label="Jump to a chapter">
            {chapters.map((chapter, index) => (
              <button
                key={chapter.time}
                type="button"
                aria-current={
                  time >= chapter.time && time < (chapters[index + 1]?.time ?? 25)
                    ? 'step'
                    : undefined
                }
                onClick={() => seek(chapter.time, true)}
              >
                <span>0:{String(chapter.time).padStart(2, '0')}</span>
                {chapter.label}
              </button>
            ))}
          </div>
          <p id="walkthrough-help">
            Press Play to watch. Pause or drag the timeline to revisit any moment.
          </p>
        </aside>
      </div>
      <details className="walkthrough-transcript">
        <summary>Read the walkthrough</summary>
        <ol>
          <li>
            Open KeyMove with <Shortcut name="focus_searchbar" /> and type “coffee”. The first
            matching text block is selected.
          </li>
          <li>
            Press <Shortcut name="next_match" /> twice to move through the next two text matches.
          </li>
          <li>
            Press <Shortcut name="dismiss_search" /> to clear the query,{' '}
            <Shortcut name="focus_searchbar" /> to refocus the search bar, then{' '}
            <Shortcut name="toggle_search_mode" /> to switch to actions.
          </li>
          <li>
            Type “Save this guide”. Press <Shortcut name="select_match" /> to activate the selected
            button and save the guide.
          </li>
        </ol>
      </details>
    </section>
  );
}
