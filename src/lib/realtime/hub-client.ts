import { HANDSHAKE_REQUEST, MESSAGE_TYPE, PING_FRAME, connectionTokenOf, decodeFrames, handshakeError, invocation, reconnectDelay, toSocketUrl, type HubMessage } from "@/lib/realtime/hub-protocol";

export type HubStatus = "idle" | "connecting" | "connected" | "reconnecting" | "stopped";
type Handler = (payload: unknown) => void;
type SocketLike = {
  readyState: number;
  send: (data: string) => void;
  close: () => void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
};
type SocketFactory = (url: string) => SocketLike;

/**
 * A minimal SignalR client for the auction hub: connect, join auctions, receive events, reconnect with backoff and join again.
 * The hub only pushes events; every write (bids, Buy Now) still goes through the normal API. When the hub cannot be reached the screen keeps
 * refreshing on a timer, so a failure here never blocks the buyer.
 */
export class AuctionHubClient {
  private socket: SocketLike | null = null;
  private status: HubStatus = "idle";
  private buffer = "";
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private counter = 0;
  private handshaken = false;
  private readonly handlers = new Map<string, Set<Handler>>();
  private readonly joined = new Set<string>();
  private readonly statusListeners = new Set<(status: HubStatus) => void>();

  constructor(
    private readonly baseUrl: string,
    private readonly makeSocket: SocketFactory = (url) => new WebSocket(url) as unknown as SocketLike,
    private readonly doFetch: typeof fetch = (...args) => fetch(...args),
  ) {}

  onStatus(listener: (status: HubStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  on(event: string, handler: Handler): () => void {
    const set = this.handlers.get(event) ?? new Set<Handler>();
    set.add(handler);
    this.handlers.set(event, set);
    return () => set.delete(handler);
  }

  async start(): Promise<void> {
    if (this.status === "connecting" || this.status === "connected" || this.status === "reconnecting") return;
    this.setStatus("connecting");
    await this.open();
  }

  join(auctionId: string): void {
    this.joined.add(auctionId);
    this.sendInvocation("JoinAuction", [auctionId]);
  }

  leave(auctionId: string): void {
    this.joined.delete(auctionId);
    this.sendInvocation("LeaveAuction", [auctionId]);
  }

  stop(): void {
    this.setStatus("stopped");
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.onmessage = null;
      socket.onerror = null;
      try { socket.close(); } catch { /* already closed */ }
    }
  }

  private setStatus(next: HubStatus) {
    this.status = next;
    for (const listener of this.statusListeners) listener(next);
  }

  private async open(): Promise<void> {
    try {
      const response = await this.doFetch(`${this.baseUrl.replace(/\/$/, "")}/hubs/auctions/negotiate?negotiateVersion=1`, { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest" } });
      if (!response.ok) throw new Error(`negotiate ${response.status}`);
      const token = connectionTokenOf(await response.json());
      if (!token) throw new Error("negotiate without a connection token");
      if (this.status === "stopped") return;
      const socket = this.makeSocket(`${toSocketUrl(this.baseUrl.replace(/\/$/, ""))}/hubs/auctions?id=${encodeURIComponent(token)}`);
      this.socket = socket;
      this.buffer = "";
      this.handshaken = false;
      socket.onopen = () => socket.send(HANDSHAKE_REQUEST);
      socket.onmessage = (event) => this.receive(String(event.data));
      socket.onclose = () => this.lost();
      socket.onerror = () => { /* the close handler follows */ };
    } catch {
      this.lost();
    }
  }

  private receive(text: string) {
    const { messages, rest } = decodeFrames(this.buffer + text);
    this.buffer = rest;
    for (const message of messages) {
      if (!this.handshaken) {
        if (handshakeError(message)) { this.lost(); return; }
        this.handshaken = true;
        this.attempt = 0;
        this.setStatus("connected");
        for (const id of this.joined) this.sendInvocation("JoinAuction", [id]);
        continue;
      }
      this.dispatch(message);
    }
  }

  private dispatch(message: HubMessage) {
    if (message.type === MESSAGE_TYPE.Ping) { this.socket?.send(PING_FRAME); return; }
    if (message.type === MESSAGE_TYPE.Close) { this.lost(); return; }
    if (message.type === MESSAGE_TYPE.Invocation && message.target) {
      for (const handler of this.handlers.get(message.target) ?? []) handler(message.arguments?.[0]);
    }
  }

  private sendInvocation(target: string, args: unknown[]) {
    if (this.status !== "connected" || !this.socket) return;
    this.socket.send(invocation(target, args, String(++this.counter)));
  }

  private lost() {
    if (this.status === "stopped") return;
    const socket = this.socket;
    this.socket = null;
    if (socket) { socket.onclose = null; try { socket.close(); } catch { /* already closed */ } }
    this.setStatus("reconnecting");
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { void this.open(); }, reconnectDelay(this.attempt++));
  }
}
