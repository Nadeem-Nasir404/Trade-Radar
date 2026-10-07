import { UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import Redis from "ioredis-mock";
import type { Session, User } from "@prisma/client";
import { AuthService } from "./auth.service";

const CONFIG: Record<string, string> = {
  JWT_ACCESS_SECRET: "access-secret-for-tests-only",
  JWT_REFRESH_SECRET: "refresh-secret-for-tests-only",
  JWT_ACCESS_TTL: "15m",
  JWT_REFRESH_TTL: "30d",
  MAGIC_LINK_SECRET: "magic-link-secret-for-tests-only",
  FRONTEND_URL: "http://localhost:3000",
};

const user = { id: "u1", email: "trader@test.dev", role: "USER" } as User;

/** Just enough of PrismaService's session/user API for AuthService, backed by a Map. */
function fakePrisma() {
  const sessions = new Map<string, Session>();
  const matches = (s: Session, where: Partial<Session>) =>
    Object.entries(where).every(([key, value]) => s[key as keyof Session] === value);

  return {
    sessions,
    session: {
      create: async ({ data }: { data: Partial<Session> }) => {
        const row = { previousTokenHash: null, rotatedAt: null, revokedAt: null, createdAt: new Date(), ...data } as Session;
        sessions.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) => sessions.get(where.id) ?? null,
      updateMany: async ({ where, data }: { where: Partial<Session>; data: Partial<Session> }) => {
        let count = 0;
        for (const s of sessions.values()) {
          if (matches(s, where)) {
            Object.assign(s, data);
            count++;
          }
        }
        return { count };
      },
    },
    user: { findUniqueOrThrow: async () => user },
  };
}

function makeService(prisma: ReturnType<typeof fakePrisma>, extras: { mailer?: unknown; usersService?: unknown } = {}) {
  const config = { get: (key: string) => CONFIG[key] };
  const redis = new Redis();
  return {
    redis,
    service: new AuthService(prisma as any, (extras.usersService ?? {}) as any, new JwtService(), config as any, (extras.mailer ?? {}) as any, redis as any),
  };
}

describe("AuthService.refresh (rotation and reuse detection)", () => {
  let prisma: ReturnType<typeof fakePrisma>;
  let service: AuthService;
  const meta = { userAgent: "jest", ipAddress: "127.0.0.1" };

  beforeEach(() => {
    prisma = fakePrisma();
    service = makeService(prisma).service;
  });

  const activeSessions = () => [...prisma.sessions.values()].filter((s) => !s.revokedAt);

  it("rotates the refresh token and keeps the same session", async () => {
    const first = await service.issueSession(user, meta);
    const { tokens } = await service.refresh(first.refreshToken, meta);

    expect(tokens.refreshToken).not.toBe(first.refreshToken);
    expect(prisma.sessions.size).toBe(1);
    expect(activeSessions()).toHaveLength(1);
    await expect(service.refresh(tokens.refreshToken, meta)).resolves.toBeDefined();
  });

  it("revokes every session when an old refresh token is replayed after the grace window", async () => {
    const first = await service.issueSession(user, meta);
    await service.issueSession(user, meta); // a second device
    const { tokens: rotated } = await service.refresh(first.refreshToken, meta);

    for (const s of prisma.sessions.values()) if (s.rotatedAt) s.rotatedAt = new Date(Date.now() - 60_000);

    await expect(service.refresh(first.refreshToken, meta)).rejects.toThrow(/reuse detected/);
    expect(activeSessions()).toHaveLength(0);
    await expect(service.refresh(rotated.refreshToken, meta)).rejects.toThrow(UnauthorizedException);
  });

  it("rejects a replay inside the grace window without revoking (two tabs refreshing at once)", async () => {
    const first = await service.issueSession(user, meta);
    const { tokens: rotated } = await service.refresh(first.refreshToken, meta);

    await expect(service.refresh(first.refreshToken, meta)).rejects.toThrow(/already rotated/);
    expect(activeSessions()).toHaveLength(1);
    await expect(service.refresh(rotated.refreshToken, meta)).resolves.toBeDefined();
  });

  it("lets only one of two simultaneous refreshes with the same token win", async () => {
    const first = await service.issueSession(user, meta);
    const results = await Promise.allSettled([service.refresh(first.refreshToken, meta), service.refresh(first.refreshToken, meta)]);

    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(activeSessions()).toHaveLength(1);
  });
});

describe("AuthService magic links", () => {
  let service: AuthService;
  let sentLinks: string[];

  beforeEach(async () => {
    sentLinks = [];
    const mailer = { send: async ({ text }: { text: string }) => void sentLinks.push(text) };
    const usersService = { findOrCreateByEmail: async (email: string) => ({ ...user, email }) };
    const made = makeService(fakePrisma(), { mailer, usersService });
    await made.redis.flushall();
    service = made.service;
  });

  const tokenFromLink = (text: string) => decodeURIComponent(/token=([^\s]+)/.exec(text)![1]);

  it("signs the user in once and rejects a second use of the same link", async () => {
    await service.requestMagicLink("trader@test.dev");
    const token = tokenFromLink(sentLinks[0]);

    await expect(service.verifyMagicLink(token)).resolves.toMatchObject({ email: "trader@test.dev" });
    await expect(service.verifyMagicLink(token)).rejects.toThrow(/already been used/);
  });

  it("keeps separately requested links independent", async () => {
    await service.requestMagicLink("trader@test.dev");
    await service.requestMagicLink("trader@test.dev");
    const [first, second] = sentLinks.map(tokenFromLink);

    await expect(service.verifyMagicLink(first)).resolves.toBeDefined();
    await expect(service.verifyMagicLink(second)).resolves.toBeDefined();
  });
});

describe("AuthService suspension", () => {
  const meta = { userAgent: "jest", ipAddress: "127.0.0.1" };

  it("refuses to open a session for a suspended user", async () => {
    const { service } = makeService(fakePrisma());
    await expect(service.issueSession({ ...user, isSuspended: true }, meta)).rejects.toThrow(/suspended/);
  });

  it("refuses to refresh once the user has been suspended", async () => {
    const prisma = fakePrisma();
    const { service } = makeService(prisma);
    const first = await service.issueSession(user, meta);

    prisma.user.findUniqueOrThrow = async () => ({ ...user, isSuspended: true });
    await expect(service.refresh(first.refreshToken, meta)).rejects.toThrow(/suspended/);
  });
});
