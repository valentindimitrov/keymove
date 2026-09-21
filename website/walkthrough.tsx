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
  {
    time: 24,
    title: 'Find a link',
    detail: 'Focus KeyMove again to look for the checklist link.',
    shortcut: 'focus_searchbar',
  },
  {
    time: 25,
    title: 'Find a link',
    detail: 'Type the link’s visible text: “Open the checklist”.',
    text: 'Open the checklist',
  },
  {
    time: 28,
    title: 'Explore the action menu',
    detail: 'Press ↓ from the search bar to see actions for the selected result.',
    shortcut: 'open_action_menu',
  },
  {
    time: 33,
    title: 'Return to your search',
    detail: 'Escape closes the menu and keeps your query.',
    text: 'Esc',
  },
  {
    time: 34,
    title: 'Find a shortcut',
    detail: 'Hover over ? to open the keyboard shortcut reference.',
    text: 'Hover ?',
  },
] as const;

const chapters = [
  { time: 0, label: 'Open and search' },
  { time: 6, label: 'Move through the page' },
  { time: 12, label: 'Find and activate a button' },
  { time: 24, label: 'Explore the action menu' },
  { time: 34, label: 'Open shortcut help' },
] as const;

export default function Walkthrough() {
  const video = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(0);
  const [failed, setFailed] = useState(false);
  const step = steps.findLast(item => time >= item.time) ?? steps[0];
  const chapterIndex = Math.max(
    0,
    chapters.findLastIndex(item => time >= item.time),
  );
  const chapter = chapters[chapterIndex] ?? chapters[0];
  const chapterSteps = steps.filter(
    item => item.time >= chapter.time && item.time < (chapters[chapterIndex + 1]?.time ?? Infinity),
  );

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
          <h2 id="walkthrough-title">From finding something to doing something</h2>
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
            aria-label="KeyMove walkthrough: search, navigate, activate, open the action menu, and show shortcut help"
            aria-describedby="walkthrough-help"
            onTimeUpdate={event => setTime(event.currentTarget.currentTime)}
            onSeeked={event => setTime(event.currentTarget.currentTime)}
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
            <ol className="walkthrough-keystrokes" aria-label={`${chapter.label}: input sequence`}>
              {chapterSteps.map(item => (
                <li key={item.time} aria-current={item === step ? 'step' : undefined}>
                  {'shortcut' in item ? <Shortcut name={item.shortcut} /> : <kbd>{item.text}</kbd>}
                </li>
              ))}
            </ol>
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
