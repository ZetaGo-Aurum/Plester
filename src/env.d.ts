declare var process: {
  on(event: string, listener: (...args: any[]) => void): void;
  removeAllListeners(event: string): void;
  removeListener(event: string, listener: (...args: any[]) => void): void;
  exit(code?: number): void;
  stderr: { write(data: string): void };
};
