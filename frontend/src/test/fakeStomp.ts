/**
 * Stands in for @stomp/stompjs in unit tests (see setup.ts), so no test opens a real socket. Tests reach
 * the client a screen created with lastClient(), then push messages, refusals and drops through it.
 */
type Config = {
  beforeConnect?: (client: FakeClient) => void | Promise<void>;
  onConnect?: (frame: unknown) => void;
  onStompError?: (frame: { headers: Record<string, string> }) => void;
  onWebSocketClose?: (event: unknown) => void;
};

type Listener = (message: { body: string }) => void;

export class FakeClient {
  static instances: FakeClient[] = [];
  /** Clients connect by themselves once activated, as if the server answered at once. */
  static autoConnect = true;

  readonly config: Config;
  connected = false;
  active = false;
  connectHeaders: Record<string, string> = {};
  readonly listeners = new Map<string, Listener>();
  readonly published: { destination: string; body: string }[] = [];

  constructor(config: Config) {
    this.config = config;
    FakeClient.instances.push(this);
  }

  activate(): void {
    this.active = true;
    if (FakeClient.autoConnect) void Promise.resolve().then(() => this.connect());
  }

  async connect(): Promise<void> {
    await this.config.beforeConnect?.(this);
    if (!this.active) return;
    this.connected = true;
    this.config.onConnect?.({});
  }

  subscribe(destination: string, listener: Listener) {
    this.listeners.set(destination, listener);
    return { unsubscribe: () => this.listeners.delete(destination) };
  }

  publish(message: { destination: string; body: string }): void {
    this.published.push(message);
  }

  async deactivate(): Promise<void> {
    this.active = false;
    this.connected = false;
  }

  /** The server sends a message to everyone subscribed to the destination. */
  deliver(destination: string, payload: unknown): void {
    this.listeners.get(destination)?.({ body: JSON.stringify(payload) });
  }

  /** The server refuses with an ERROR frame carrying this code. */
  refuse(code: string): void {
    this.config.onStompError?.({ headers: { message: code } });
  }

  forceDisconnect(): void {
    this.drop();
  }

  /** The connection drops. */
  drop(): void {
    this.connected = false;
    this.config.onWebSocketClose?.({});
  }
}

export function lastClient(): FakeClient {
  const client = FakeClient.instances.at(-1);
  if (!client) throw new Error('No live connection was opened');
  return client;
}

export const fakeStompModule = {
  Client: FakeClient,
  ReconnectionTimeMode: { LINEAR: 0, EXPONENTIAL: 1 },
};
