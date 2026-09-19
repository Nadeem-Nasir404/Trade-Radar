export const ACCESS_TOKEN_COOKIE = "lp_access_token";
export const REFRESH_TOKEN_COOKIE = "lp_refresh_token";

export interface AccessTokenPayload {
  sub: string; // userId
  email: string;
  role: "USER" | "ADMIN";
}
