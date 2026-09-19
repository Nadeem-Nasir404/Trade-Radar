import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    // This guard is registered globally (APP_GUARD), so it also runs for EventsGateway's
    // @SubscribeMessage handlers. Passport's AuthGuard expects an HTTP-shaped request
    // (req.headers.authorization) and throws on the WS execution context, which has none.
    // EventsGateway already authenticates the socket itself in handleConnection() and
    // disconnects anything without a valid token, so WS contexts skip this guard entirely.
    if (context.getType() !== "http") return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<TUser = unknown>(err: unknown, user: TUser): TUser {
    if (err || !user) {
      throw err instanceof Error ? new UnauthorizedException(err.message) : new UnauthorizedException("Authentication required.");
    }
    return user;
  }
}
