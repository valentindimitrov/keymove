declare module 'web-ext' {
  export type ChromiumClient = {
    sendCommand(
      method: string,
      params: Record<string, unknown>,
      sessionId?: string,
    ): Promise<unknown>;
  };
  type RunOptions = {
    sourceDir: string;
    target: 'chromium' | 'firefox-desktop';
    chromiumBinary?: string;
    firefox?: string;
    startUrl: string[];
    noReload: boolean;
    noInput: boolean;
    chromiumPref?: Record<string, boolean | string | number | string[]>;
  };
  const webExt: {
    cmd: {
      run(
        options: RunOptions,
        execution: { shouldExitProgram: boolean },
      ): Promise<{
        extensionRunners: { cdp?: ChromiumClient }[];
        exit(): Promise<void>;
      }>;
    };
  };
  export default webExt;
}
