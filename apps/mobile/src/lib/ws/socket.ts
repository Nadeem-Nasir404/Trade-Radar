import { io, type Socket } from "socket.io-client";
import { tokenStore } from "../api/token-store";

const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

/**
 * Unlike the web client (which relies on an httpOnly cookie automatically sent on the WS
 * handshake), native has no cookie jar - the access token is read from secure storage and
 * passed explicitly via `auth`, which EventsGateway.handleConnection already accepts as a
 * fallback alongside the cookie.
 */
export async function getSocket(): Promise<Socket> {
  if (!socket) {
    socket = io(`${WS_URL}/ws`, {
      autoConnect: true,
      transports: ["websocket"],
      // Callback form: re-read the token on every (re)connect. A static token expires after
      // 15 minutes, and every reconnect would then be rejected, silently freezing live prices.
      auth: (cb) => {
        tokenStore.getAccessToken().then((token) => cb({ token }));
      },
    });
    // A server-initiated disconnect (e.g. rejected handshake) is never auto-retried by socket.io,
    // so reconnect manually - the auth callback above picks up whatever token is current by then.
    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect") setTimeout(() => socket?.connect(), 1000);
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
