import { Bell, Gauge, LayoutGrid, Map, Star } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/markets", label: "Markets", icon: LayoutGrid },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/watchlists", label: "Watchlists", icon: Star },
  { href: "/level-map", label: "Level Map", icon: Map },
];

export const MOBILE_NAV_ITEMS = [
  { href: "/dashboard", label: "Home", icon: Gauge },
  { href: "/markets", label: "Markets", icon: LayoutGrid },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/watchlists", label: "Watchlist", icon: Star },
];
