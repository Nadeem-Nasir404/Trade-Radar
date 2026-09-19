import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { OnEvent } from "@nestjs/event-emitter";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { WS_EVENTS, type MarketStaleEvent, type MarketResumedEvent, type PriceUpdateEvent, type AlertTriggeredEvent } from "@levelpulse/shared-types";
import type { EnvConfig } from "../common/config/env.validation";
import { ACCESS_TOKEN_COOKIE, type AccessTokenPayload } from "../auth/auth.constants";
import { SubscriptionRegistryService } from "../market-data/subscription-registry.service";
import { MarketDataService } from "../market-data/market-data.service";
import { MARKET_RESUMED_EVENT, MARKET_STALE_EVENT, MARKET_TICK_EVENT, type MarketTickEvent, type MarketStaleEventPayload, type MarketResumedEventPayload } from "../market-data/market-data.events";
import { ALERT_TRIGGERED_EVENT, type AlertTriggeredPayload } from "../alert-engine/alert-engine.events";

function instrumentRoom(instrumentId: string) {
  return `instrument:${instrumentId}`;
}
function userRoom(userId: string) {
  return `user:${userId}`;
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((pair) => {
      const [key, ...rest] = pair.trim().split("=");
      return [key, decodeURIComponent(rest.join("="))];
    }),
  );
}

@WebSocketGateway({ namespace: "/ws", cors: { origin: true, credentials: true } })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);
  /** connectionId -> set of instrumentIds it's currently subscribed to, so disconnect can clean up refs. */
  private readonly connectionSubscriptions = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly registry: SubscriptionRegistryService,
    private readonly marketData: MarketDataService,
  ) {}

  async handleConnection(socket: Socket) {
    const token =
      (socket.handshake.auth?.token as string | undefined) ??
      parseCookies(socket.handshake.headers.cookie)[ACCESS_TOKEN_COOKIE];

    if (!token) {
      socket.disconnect();
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
      });
      socket.data.userId = payload.sub;
      await socket.join(userRoom(payload.sub));
      this.connectionSubscriptions.set(socket.id, new Set());
    } catch {
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const subscriptions = this.connectionSubscriptions.get(socket.id);
    if (subscriptions) {
      for (const instrumentId of subscriptions) {
        const result = await this.registry.removeViewerRef(instrumentId, socket.id);
        if (result.becameInactive) await this.marketData.releaseSubscriptionById(instrumentId);
      }
    }
    this.connectionSubscriptions.delete(socket.id);
  }

  @SubscribeMessage(WS_EVENTS.SUBSCRIBE_INSTRUMENT)
  async onSubscribeInstrument(@ConnectedSocket() socket: Socket, @MessageBody() data: { instrumentId: string }) {
    await socket.join(instrumentRoom(data.instrumentId));
    this.connectionSubscriptions.get(socket.id)?.add(data.instrumentId);
    const result = await this.registry.addViewerRef(data.instrumentId, socket.id);
    if (result.becameActive) await this.marketData.ensureSubscribedById(data.instrumentId);
  }

  @SubscribeMessage(WS_EVENTS.UNSUBSCRIBE_INSTRUMENT)
  async onUnsubscribeInstrument(@ConnectedSocket() socket: Socket, @MessageBody() data: { instrumentId: string }) {
    await socket.leave(instrumentRoom(data.instrumentId));
    this.connectionSubscriptions.get(socket.id)?.delete(data.instrumentId);
    const result = await this.registry.removeViewerRef(data.instrumentId, socket.id);
    if (result.becameInactive) await this.marketData.releaseSubscriptionById(data.instrumentId);
  }

  @SubscribeMessage(WS_EVENTS.HEARTBEAT)
  async onHeartbeat(@ConnectedSocket() socket: Socket, @MessageBody() data: { instrumentIds: string[] }) {
    for (const instrumentId of data.instrumentIds ?? []) {
      await this.registry.heartbeatViewerRef(instrumentId, socket.id);
    }
  }

  @OnEvent(MARKET_TICK_EVENT)
  handleTick(tick: MarketTickEvent) {
    const payload: PriceUpdateEvent = {
      instrumentId: tick.instrumentId,
      symbol: tick.symbol,
      price: tick.price,
      prevPrice: tick.prevPrice,
      changePct24h: tick.changePct24h,
      eventTime: tick.eventTime,
    };
    this.server.to(instrumentRoom(tick.instrumentId)).emit(WS_EVENTS.PRICE_UPDATE, payload);
  }

  @OnEvent(MARKET_STALE_EVENT)
  handleStale(event: MarketStaleEventPayload) {
    const payload: MarketStaleEvent = { instrumentId: event.instrumentId, symbol: event.symbol, lastUpdateAt: event.lastUpdateAt };
    this.server.to(instrumentRoom(event.instrumentId)).emit(WS_EVENTS.MARKET_STALE, payload);
  }

  @OnEvent(MARKET_RESUMED_EVENT)
  handleResumed(event: MarketResumedEventPayload) {
    const payload: MarketResumedEvent = { instrumentId: event.instrumentId, symbol: event.symbol };
    this.server.to(instrumentRoom(event.instrumentId)).emit(WS_EVENTS.MARKET_RESUMED, payload);
  }

  @OnEvent(ALERT_TRIGGERED_EVENT)
  handleAlertTriggered(event: AlertTriggeredPayload) {
    const payload: AlertTriggeredEvent = {
      alertId: event.alertId,
      alertEventId: event.alertEventId,
      instrumentId: event.instrumentId,
      symbol: event.symbol,
      conditionType: event.conditionType,
      targetValue: event.targetValue,
      observedPrice: event.observedPrice,
      eventTime: event.eventTime,
    };
    this.server.to(userRoom(event.userId)).emit(WS_EVENTS.ALERT_TRIGGERED, payload);
  }
}
