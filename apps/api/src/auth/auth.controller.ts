import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Ip,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request, Response } from "express";
import { AuthService, type TokenPair } from "./auth.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { MagicLinkRequestDto } from "./dto/magic-link-request.dto";
import { LocalAuthGuard } from "./guards/local-auth.guard";
import { GoogleAuthGuard } from "./guards/google-auth.guard";
import { Public } from "../common/decorators/public.decorator";
import { CurrentUser, type AuthenticatedUser } from "../common/decorators/current-user.decorator";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "./auth.constants";
import type { EnvConfig } from "../common/config/env.validation";
import type { GoogleProfile } from "./strategies/google.strategy";
import type { User } from "@prisma/client";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  private setTokenCookies(res: Response, tokens: TokenPair) {
    const isProd = this.config.get("NODE_ENV", { infer: true }) === "production";
    res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: tokens.accessTokenExpiresInSeconds * 1000,
    });
    res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: "lax",
      path: "/",
      maxAge: tokens.refreshTokenExpiresInSeconds * 1000,
    });
  }

  private clearTokenCookies(res: Response) {
    res.clearCookie(ACCESS_TOKEN_COOKIE, { path: "/" });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: "/" });
  }

  private sanitize(user: User) {
    const { passwordHash: _passwordHash, ...safe } = user;
    return safe;
  }

  /**
   * Native clients (Expo/React Native) have no cookie jar, so every token-issuing endpoint
   * also returns the raw tokens in the JSON body - the mobile app stores them in
   * expo-secure-store and sends them back as `Authorization: Bearer`, which JwtStrategy already
   * accepts as a fallback extractor alongside the cookie. The web app ignores these extra
   * fields and relies solely on the httpOnly cookies set alongside them.
   */
  private tokenFields(tokens: TokenPair) {
    return { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken };
  }

  @Public()
  @Post("register")
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
    @Req() req: Request,
  ) {
    const user = await this.authService.register(dto.email, dto.password, dto.name);
    const tokens = await this.authService.issueSession(user, { userAgent: req.headers["user-agent"], ipAddress: ip });
    this.setTokenCookies(res, tokens);
    return { user: this.sanitize(user), ...this.tokenFields(tokens) };
  }

  @Public()
  @UseGuards(LocalAuthGuard)
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() _dto: LoginDto, // unused directly - passport's LocalStrategy already read email/password off req.body; this triggers DTO validation on the same body
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const user = req.user as User;
    const tokens = await this.authService.issueSession(user, { userAgent: req.headers["user-agent"], ipAddress: ip });
    this.setTokenCookies(res, tokens);
    return { user: this.sanitize(user), ...this.tokenFields(tokens) };
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body("refreshToken") bodyToken: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Ip() ip: string,
  ) {
    const rawToken = bodyToken ?? req.cookies?.[REFRESH_TOKEN_COOKIE];
    if (!rawToken) throw new UnauthorizedException("No refresh token provided");
    const { user, tokens } = await this.authService.refresh(rawToken, {
      userAgent: req.headers["user-agent"],
      ipAddress: ip,
    });
    this.setTokenCookies(res, tokens);
    return { user: this.sanitize(user), ...this.tokenFields(tokens) };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Body("refreshToken") bodyToken: string | undefined, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawToken = bodyToken ?? req.cookies?.[REFRESH_TOKEN_COOKIE];
    const sessionId = rawToken ? this.authService.decodeSessionId(rawToken) : null;
    if (sessionId) await this.authService.revokeSession(sessionId);
    this.clearTokenCookies(res);
    return { success: true };
  }

  @Get("me")
  me(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }

  // --- Google OAuth ---------------------------------------------------------

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get("google")
  googleLogin() {
    // handled by GoogleAuthGuard, which redirects to Google
  }

  @Public()
  @UseGuards(GoogleAuthGuard)
  @Get("google/callback")
  async googleCallback(@Req() req: Request, @Res() res: Response, @Ip() ip: string) {
    const profile = req.user as GoogleProfile;
    const user = await this.authService.handleGoogleLogin(profile);
    const tokens = await this.authService.issueSession(user, { userAgent: req.headers["user-agent"], ipAddress: ip });
    this.setTokenCookies(res, tokens);
    res.redirect(`${this.config.get("FRONTEND_URL", { infer: true })}/dashboard`);
  }

  // --- Magic link --------------------------------------------------------

  @Public()
  @Post("magic-link/request")
  @HttpCode(HttpStatus.OK)
  async requestMagicLink(@Body() dto: MagicLinkRequestDto) {
    await this.authService.requestMagicLink(dto.email);
    return { message: "If that email exists, a sign-in link has been sent." };
  }

  @Public()
  @Post("magic-link/verify")
  @HttpCode(HttpStatus.OK)
  async verifyMagicLink(
    @Body("token") token: string,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
    @Ip() ip: string,
  ) {
    const user = await this.authService.verifyMagicLink(token);
    const tokens = await this.authService.issueSession(user, { userAgent: req.headers["user-agent"], ipAddress: ip });
    this.setTokenCookies(res, tokens);
    return { user: this.sanitize(user), ...this.tokenFields(tokens) };
  }
}
