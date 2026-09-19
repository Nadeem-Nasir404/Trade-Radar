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
    const accessToken = await tokenStore.getAccessToken();
    socket = io(`${WS_URL}/ws`, {
      autoConnect: true,
      transports: ["websocket"],
      auth: { token: accessToken },
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}
