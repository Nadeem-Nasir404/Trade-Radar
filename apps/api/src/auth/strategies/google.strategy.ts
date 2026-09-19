import { Injectable, Logger } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { Strategy, type Profile, type VerifyCallback } from "passport-google-oauth20";
import type { EnvConfig } from "../../common/config/env.validation";

export interface GoogleProfile {
  googleId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
  private readonly logger = new Logger(GoogleStrategy.name);
  readonly isConfigured: boolean;

  constructor(config: ConfigService<EnvConfig, true>) {
    const clientID = config.get("GOOGLE_CLIENT_ID", { infer: true });
    const clientSecret = config.get("GOOGLE_CLIENT_SECRET", { infer: true });
    const callbackURL =
      config.get("GOOGLE_CALLBACK_URL", { infer: true }) ??
      "http://localhost:4000/api/v1/auth/google/callback";

    super({
      clientID: clientID || "not-configured",
      clientSecret: clientSecret || "not-configured",
      callbackURL,
      scope: ["email", "profile"],
    });

    this.isConfigured = Boolean(clientID && clientSecret);
    if (!this.isConfigured) {
      this.logger.warn("GOOGLE_CLIENT_ID/SECRET not set - Google login will not work until configured.");
    }
  }

  validate(_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) {
    const email = profile.emails?.[0]?.value;
    if (!email) {
      return done(new Error("Google account has no email address"), false);
    }
    const googleProfile: GoogleProfile = {
      googleId: profile.id,
      email,
      name: profile.displayName ?? null,
      avatarUrl: profile.photos?.[0]?.value ?? null,
    };
    done(null, googleProfile);
  }
}
