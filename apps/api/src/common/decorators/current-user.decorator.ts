import { createParamDecorator, type ExecutionContext } from "@nestjs/common";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
}

/** Reads the user attached to the request by JwtAuthGuard. Usage: `@CurrentUser() user: AuthenticatedUser`. */
export const CurrentUser = createParamDecorator((data: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  const user: AuthenticatedUser | undefined = request.user;
  return data ? user?.[data] : user;
});
