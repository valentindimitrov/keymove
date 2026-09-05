import FindInPage from './find_in_page.js';

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get: () => 100,
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get: () => 20,
  });
});

test('rebuilds the shared index when the document body is replaced', async () => {
  document.body.innerHTML = '<button>Old action</button>';
  expect((await new FindInPage('old').findMatches()).matchingLinksAndButtons).toHaveLength(1);

  const replacementBody = document.createElement('body');
  replacementBody.innerHTML = '<button>New action</button>';
  document.documentElement.replaceChild(replacementBody, document.body);
  const newButton = replacementBody.querySelector('button');

  expect((await new FindInPage('new').findMatches()).matchingLinksAndButtons).toEqual([newButton]);
});
