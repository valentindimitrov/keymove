import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import type { ChromiumClient } from 'web-ext';

export function boundedClient(client: ChromiumClient): ChromiumClient {
  return {
    async sendCommand(method, params, sessionId) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        return await Promise.race([
          client.sendCommand(method, params, sessionId),
          new Promise<never>((_resolve, reject) => {
            timer = setTimeout(
              () => reject(new Error(`Browser command timed out: ${method}`)),
              20000,
            );
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function record(value: unknown): Record<string, unknown> {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'Malformed browser response');
  return value as Record<string, unknown>;
}

export async function openPage(client: ChromiumClient, url: string) {
  const targetId = record(await client.sendCommand('Target.createTarget', { url }))['targetId'];
  assert.equal(typeof targetId, 'string');
  // Vivaldi initially exposes an empty target before its renderer exists. Attaching
  // then can leave Runtime.evaluate waiting forever, even for a synchronous read.
  const deadline = Date.now() + 10000;
  while (true) {
    const info = record(
      record(await client.sendCommand('Target.getTargetInfo', { targetId }))['targetInfo'],
    );
    if (info['url'] === url && typeof info['title'] === 'string' && info['title']) break;
    assert(Date.now() < deadline, `Page did not load: ${url}. Target: ${JSON.stringify(info)}`);
    await delay(50);
  }
  const sessionId = record(
    await client.sendCommand('Target.attachToTarget', { targetId, flatten: true }),
  )['sessionId'];
  assert.equal(typeof sessionId, 'string');
  const session = sessionId as string;
  return {
    activate: () => client.sendCommand('Target.activateTarget', { targetId }),
    close: () => client.sendCommand('Target.closeTarget', { targetId }),
    setColorScheme: (value: 'light' | 'dark' | '') =>
      client.sendCommand(
        'Emulation.setEmulatedMedia',
        {
          features: value ? [{ name: 'prefers-color-scheme', value }] : [],
        },
        session,
      ),
    setViewport: (width: number, height: number) =>
      client.sendCommand(
        'Emulation.setDeviceMetricsOverride',
        {
          width,
          height,
          deviceScaleFactor: 1,
          mobile: false,
        },
        session,
      ),
    async screenshot(): Promise<Buffer> {
      const response = record(
        await client.sendCommand('Page.captureScreenshot', { format: 'png' }, session),
      );
      assert.equal(typeof response['data'], 'string');
      return Buffer.from(response['data'] as string, 'base64');
    },
    async evaluate(expression: string): Promise<unknown> {
      const response = record(
        await client.sendCommand(
          'Runtime.evaluate',
          {
            expression,
            awaitPromise: true,
            returnByValue: true,
          },
          session,
        ),
      );
      assert(!response['exceptionDetails'], JSON.stringify(response['exceptionDetails']));
      return record(response['result'])['value'];
    },
    async key(key: string, modifiers = 0) {
      const codes: Record<string, number> = {
        Tab: 9,
        Enter: 13,
        Escape: 27,
        Backspace: 8,
        ArrowLeft: 37,
        ArrowRight: 39,
        ArrowDown: 40,
        ArrowUp: 38,
        Home: 36,
        End: 35,
      };
      const character = Array.from(key).length === 1;
      const ascii = /^[a-z0-9]$/i.test(key);
      const code = /^\d$/.test(key)
        ? `Digit${key}`
        : ascii
          ? `Key${key.toUpperCase()}`
          : character
            ? ''
            : key;
      const windowsVirtualKeyCode = codes[key] ?? (ascii ? key.toUpperCase().charCodeAt(0) : 0);
      const params = { key, code, modifiers, windowsVirtualKeyCode };
      await client.sendCommand(
        'Input.dispatchKeyEvent',
        {
          ...params,
          type: 'keyDown',
          ...(character && modifiers === 0 ? { text: key } : {}),
        },
        session,
      );
      await client.sendCommand('Input.dispatchKeyEvent', { ...params, type: 'keyUp' }, session);
    },
  };
}

export type TestPage = Awaited<ReturnType<typeof openPage>>;

export async function waitFor(page: TestPage, expression: string) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (await page.evaluate(`Boolean(${expression})`)) return;
    await delay(25);
  }
  const state = await page.evaluate(`({url: location.href, title: document.title,
    focused: document.hasFocus(), activeElement: document.activeElement?.outerHTML.slice(0, 200),
    shadowActive: document.getElementById('keymove-root')?.shadowRoot?.activeElement?.outerHTML.slice(0, 200),
    summary: document.getElementById('keymove-root')?.shadowRoot?.querySelector('[role="status"]')?.textContent,
    input: document.getElementById('keymove-root')?.shadowRoot?.querySelector('input')?.value})`);
  throw new Error(`Timed out: ${expression}. Page state: ${JSON.stringify(state)}`);
}
