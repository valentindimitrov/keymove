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
    detail: 'Just “cof” finds “coffee” on the page. You do not need the whole word.',
    text: 'cof',
  },
  {
    time: 6,
    title: 'Jump between matches',
    detail: 'Each press of Tab selects the next complete text block.',
    shortcut: 'next_match',
  },
  {
    time: 9,
    title: 'Keep moving',
    detail: 'Press Tab again to select the third matching text block.',
    shortcut: 'next_match',
  },
  {
    time: 12,
    title: 'Close the search',
    detail: 'Escape closes the search, ready for your next move.',
    shortcut: 'dismiss_search',
  },
  {
    time: 14,
    title: 'Focus the search bar',
    detail: 'Bring the search bar back into focus.',
    shortcut: 'focus_searchbar',
  },
  {
    time: 16,
    title: 'Switch to actions',
    detail: 'Search links, buttons, and other controls.',
    shortcut: 'toggle_search_mode',
  },
  {
    time: 18,
    title: 'Find a button',
    detail: 'Type the button’s name: “Save this guide”.',
    text: 'Save this guide',
  },
  {
    time: 24,
    title: 'Make it happen',
    detail: 'Enter activates the selected button. The guide is saved.',
    shortcut: 'select_match',
  },
  {
    time: 28,
    title: 'Find a link',
    detail: 'Focus KeyMove again to look for the checklist link.',
    shortcut: 'focus_searchbar',
  },
  {
    time: 29,
    title: 'Find a link',
    detail: 'Type the link’s visible text: “Open the checklist”.',
    text: 'Open the checklist',
  },
  {
    time: 32,
    title: 'Explore the action menu',
    detail: 'Press ↓ from the search bar to see actions for the selected result.',
    shortcut: 'open_action_menu',
  },
  {
    time: 37,
    title: 'Return to your search',
    detail: 'Escape closes the menu and keeps your query.',
    text: 'Esc',
  },
  {
    time: 38,
    title: 'Find a shortcut',
    detail: 'Hover over ? to open the keyboard shortcut reference.',
    text: 'Hover ?',
  },
] as const;

const chapters = [
  { time: 0, label: 'Open and search' },
  { time: 6, label: 'Move through the page' },
  { time: 12, label: 'Find and activate a button' },
  { time: 28, label: 'Explore the action menu' },
  { time: 38, label: 'Open shortcut help' },
] as const;

export default function Walkthrough() {
  const video = useRef<HTMLVideoElement>(null);
  const pendingSeek = useRef<number | null>(null);
  const [time, setTime] = useState(0);
  const [failed, setFailed] = useState(false);
  const step = steps.findLast(item => time >= item.time) ?? steps[0];
  const chapterIndex = Math.max(
    0,
    chapters.findLastIndex(item => time >= item.time),
  );
  const chapter = chapters[chapterIndex] ?? chapters[0];

  function applyPendingSeek() {
    const player = video.current;
    if (!player || !Number.isFinite(player.duration) || pendingSeek.current === null) return;
    player.currentTime = Math.min(player.duration, pendingSeek.current);
  }

  function seek(seconds: number) {
    // Land inside the chapter's first frame, avoiding decoder rounding at its boundary.
    pendingSeek.current = seconds + 0.05;
    setTime(seconds);
    applyPendingSeek();
  }

  function syncTime(player: HTMLVideoElement, settled = false) {
    if (pendingSeek.current !== null) {
      // Earlier seek/timeupdate events must not overwrite a newer chapter click.
      if (!settled || Math.abs(player.currentTime - pendingSeek.current) > 0.15) return;
      pendingSeek.current = null;
    }
    setTime(player.currentTime);
  }

  return (
    <section className="walkthrough wrap" aria-labelledby="walkthrough-title">
      <div className="section-heading">
        <div>
          <h2 id="walkthrough-title">From finding something to doing something</h2>
        </div>
      </div>
      <div className="walkthrough-player">
        <div className="walkthrough-screen">
          <video
            ref={video}
            controls
            playsInline
            preload="auto"
            poster={poster}
            aria-label="KeyMove walkthrough: search, navigate, activate, open the action menu, and show shortcut help"
            aria-describedby="walkthrough-help"
            onLoadedMetadata={applyPendingSeek}
            onTimeUpdate={event => syncTime(event.currentTarget)}
            onSeeked={event => syncTime(event.currentTarget, true)}
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
        </div>
        <aside className="walkthrough-guide" aria-label="Walkthrough guide">
          <div className="walkthrough-caption">
            <h3>{chapter.label}</h3>
            <p aria-live="polite" aria-atomic="true">
              {step.detail}
            </p>
          </div>
          <div className="walkthrough-chapters" role="group" aria-label="Jump to a chapter">
            {chapters.map((chapter, index) => (
              <button
                key={chapter.time}
                type="button"
                aria-current={
                  time >= chapter.time && time < (chapters[index + 1]?.time ?? Infinity)
                    ? 'step'
                    : undefined
                }
                onClick={() => seek(chapter.time)}
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
      <details className="walkthrough-transcript" open>
        <summary>Read the walkthrough</summary>
        <ol>
          <li>
            Open KeyMove with <Shortcut name="focus_searchbar" /> and type just “cof”. It matches
            “coffee” without typing the whole word. The first matching text block is selected.
          </li>
          <li>
            Press <Shortcut name="next_match" /> twice to move through the next two text matches.
          </li>
          <li>
            Press <Shortcut name="dismiss_search" /> to close the search,{' '}
            <Shortcut name="focus_searchbar" /> to refocus the search bar, then{' '}
            <Shortcut name="toggle_search_mode" /> to switch to actions. Type “Save this guide”.
            Press <Shortcut name="select_match" /> to activate the selected button and save the
            guide.
          </li>
          <li>
            Focus KeyMove and type “Open the checklist”. Press <Shortcut name="open_action_menu" />{' '}
            to see the selected link’s actions, including opening it or copying its address. Press
            Esc to return to the same search.
          </li>
          <li>Hover over the ? button to show the keyboard shortcut reference.</li>
        </ol>
      </details>
    </section>
  );
}
