"use client";

import { io, type Socket } from "socket.io-client";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "http://localhost:4000";

let socket: Socket | null = null;

/**
 * Lazily-created singleton Socket.IO connection, shared by every hook that needs live data.
 * Auth is via the lp_access_token cookie (withCredentials) - see EventsGateway.handleConnection.
 */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(`${WS_URL}/ws`, {
      withCredentials: true,
      autoConnect: true,
      transports: ["websocket"],
    });
  }
  return socket;
}
