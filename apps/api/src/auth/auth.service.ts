import { createHash, randomUUID } from "node:crypto";
import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import type { User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { UsersService } from "../users/users.service";
import { MailerService } from "../common/mailer/mailer.service";
import type { EnvConfig } from "../common/config/env.validation";
import type { GoogleProfile } from "./strategies/google.strategy";
import type { AccessTokenPayload } from "./auth.constants";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresInSeconds: number;
}

interface RefreshTokenPayload {
  sub: string;
  sid: string;
  /** Random per-token id, so two rotations within the same second never produce identical tokens. */
  jti?: string;
}

/** A just-rotated token presented again within this window is two tabs racing, not a stolen token. */
const REFRESH_REUSE_GRACE_MS = 30_000;

const TTL_UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

function ttlToSeconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) return 900;
  return (Number(match[1]) * TTL_UNIT_MS[match[2]]) / 1000;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService<EnvConfig, true>,
    private readonly mailer: MailerService,
  ) {}

  async validateLocalUser(email: string, password: string): Promise<User> {
    const user = await this.usersService.findByEmail(email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException("Invalid email or password");
    }
    if (user.isSuspended) {
      throw new UnauthorizedException("This account has been suspended. Contact support for details.");
    }
    return user;
  }

  async register(email: string, password: string, name?: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, 12);
    return this.usersService.createLocalUser({ email, passwordHash, name });
  }

  async issueSession(user: User, meta: { userAgent?: string; ipAddress?: string }): Promise<TokenPair> {
    const sessionId = randomUUID();
    const tokens = await this.signTokenPair(user, sessionId);

    await this.prisma.session.create({
      data: {
        id: sessionId,
        userId: user.id,
        refreshTokenHash: hashToken(tokens.refreshToken),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + tokens.refreshTokenExpiresInSeconds * 1000),
      },
    });

    return tokens;
  }

  private async signTokenPair(user: User, sessionId: string): Promise<TokenPair> {
    const accessTtl = this.config.get("JWT_ACCESS_TTL", { infer: true });
    const refreshTtl = this.config.get("JWT_REFRESH_TTL", { infer: true });

    const payload: AccessTokenPayload = { sub: user.id, email: user.email, role: user.role };
    // expiresIn's type is branded to a template-literal subset by @types/jsonwebtoken; our TTLs
    // come from validated env config as plain strings ("15m", "30d") that satisfy it at runtime.
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.config.get("JWT_ACCESS_SECRET", { infer: true }),
      expiresIn: accessTtl as any,
    });

    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, sid: sessionId, jti: randomUUID() } satisfies RefreshTokenPayload,
      { secret: this.config.get("JWT_REFRESH_SECRET", { infer: true }), expiresIn: refreshTtl as any },
    );

    return {
      accessToken,
      refreshToken,
      accessTokenExpiresInSeconds: ttlToSeconds(accessTtl),
      refreshTokenExpiresInSeconds: ttlToSeconds(refreshTtl),
    };
  }

  /** Rotates a refresh token. Detects reuse of an already-rotated token and revokes the whole session chain. */
  async refresh(rawRefreshToken: string, meta: { userAgent?: string; ipAddress?: string }): Promise<{ user: User; tokens: TokenPair }> {
    let decoded: RefreshTokenPayload;
    try {
      decoded = await this.jwtService.verifyAsync(rawRefreshToken, {
        secret: this.config.get("JWT_REFRESH_SECRET", { infer: true }),
      });
    } catch {
      throw new UnauthorizedException("Invalid or expired refresh token");
    }

    const session = await this.prisma.session.findUnique({ where: { id: decoded.sid } });
    if (!session || session.userId !== decoded.sub) {
      throw new UnauthorizedException("Session not found");
    }
    if (session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session has expired or been revoked");
    }
    const presentedHash = hashToken(rawRefreshToken);
    if (session.refreshTokenHash !== presentedHash) {
      const isConcurrentRefresh =
        session.previousTokenHash === presentedHash &&
        session.rotatedAt !== null &&
        Date.now() - session.rotatedAt.getTime() < REFRESH_REUSE_GRACE_MS;
      if (isConcurrentRefresh) throw new UnauthorizedException("Refresh token was already rotated");

      this.logger.warn(`Refresh token reuse detected for user ${decoded.sub} - revoking all sessions`);
      await this.revokeAllSessions(decoded.sub);
      throw new UnauthorizedException("Refresh token reuse detected. All sessions have been revoked for your safety.");
    }

    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: decoded.sub } });
    const tokens = await this.signTokenPair(user, session.id);

    // Rotate in place: the session keeps its id, so a later replay of this token hits the hash
    // mismatch above instead of a revoked-session dead end. Conditional on the hash we checked,
    // so of two concurrent refreshes with the same token only one wins.
    const rotated = await this.prisma.session.updateMany({
      where: { id: session.id, refreshTokenHash: presentedHash, revokedAt: null },
      data: {
        refreshTokenHash: hashToken(tokens.refreshToken),
        previousTokenHash: presentedHash,
        rotatedAt: new Date(),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + tokens.refreshTokenExpiresInSeconds * 1000),
      },
    });
    if (rotated.count !== 1) throw new UnauthorizedException("Refresh token was already rotated");

    return { user, tokens };
  }

  /** Decodes (without verifying) a refresh token to find its session id, for logout cleanup. */
  decodeSessionId(rawRefreshToken: string): string | null {
    const decoded = this.jwtService.decode<RefreshTokenPayload>(rawRefreshToken);
    return decoded?.sid ?? null;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id: sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async handleGoogleLogin(profile: GoogleProfile): Promise<User> {
    return this.usersService.findOrCreateFromOAuth({
      email: profile.email,
      name: profile.name,
      avatarUrl: profile.avatarUrl,
      provider: "google",
      providerAccountId: profile.googleId,
    });
  }

  async requestMagicLink(email: string): Promise<void> {
    const token = await this.jwtService.signAsync(
      { email: email.toLowerCase(), purpose: "magic-link" },
      { secret: this.config.get("MAGIC_LINK_SECRET", { infer: true }), expiresIn: "15m" },
    );
    const link = `${this.config.get("FRONTEND_URL", { infer: true })}/auth/magic-link?token=${encodeURIComponent(token)}`;

    await this.mailer.send({
      to: email,
      subject: "Your CoinRadar sign-in link",
      html: `<p>Click below to sign in to CoinRadar. This link expires in 15 minutes.</p><p><a href="${link}">Sign in to CoinRadar</a></p><p>If you didn't request this, you can safely ignore this email.</p>`,
      text: `Sign in to CoinRadar: ${link} (expires in 15 minutes)`,
    });
  }

  async verifyMagicLink(token: string): Promise<User> {
    let decoded: { email: string; purpose: string };
    try {
      decoded = await this.jwtService.verifyAsync(token, {
        secret: this.config.get("MAGIC_LINK_SECRET", { infer: true }),
      });
    } catch {
      throw new UnauthorizedException("This sign-in link is invalid or has expired");
    }
    if (decoded.purpose !== "magic-link") {
      throw new UnauthorizedException("Invalid token");
    }
    return this.usersService.findOrCreateByEmail(decoded.email);
  }
}
