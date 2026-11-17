// Add DOM-specific assertions to Vitest's expect API.
import '@testing-library/jest-dom/vitest';
import { acceptSyntheticInputForTesting } from './lib/trusted_input.js';

// jsdom cannot create trusted events, so tests stand in for real input. Tests of the
// untrusted-event rejection switch this off for their duration.
acceptSyntheticInputForTesting(true);
