import { NextResponse, type NextRequest } from "next/server";

const ACCESS_TOKEN_COOKIE = "lp_access_token";
const AUTH_ROUTES = ["/login", "/register", "/magic-link"];
const APP_ROUTE_PREFIXES = ["/dashboard", "/markets", "/alerts", "/watchlists", "/level-map", "/settings", "/admin"];

/**
 * UX-level redirect only (presence-check, not signature verification) - the API is the real
 * authorization boundary. This just avoids flashing an authenticated shell at a logged-out
 * visitor, or a login form at an already-authenticated one.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(ACCESS_TOKEN_COOKIE);

  const isAppRoute = APP_ROUTE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const isAuthRoute = AUTH_ROUTES.some((route) => pathname.startsWith(route));

  if (isAppRoute && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/markets/:path*", "/alerts/:path*", "/watchlists/:path*", "/level-map/:path*", "/settings/:path*", "/admin/:path*", "/login", "/register", "/magic-link"],
};
