"use client";

import { usePathname } from "next/navigation";
import NavBar from "./NavBar";

// Routes that should render bare — no nav bar, no site chrome — because
// they're meant to be embedded in someone else's page (the gallery
// widget) or printed/saved as a standalone document (a certificate).
// Checked by pathname here, in one place, rather than duplicating a
// "hide the nav" flag across every page component.
const BARE_PREFIXES = ["/embed", "/certificate"];

export default function ChromeWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isBare = BARE_PREFIXES.some((p) => pathname?.startsWith(p));

  if (isBare) {
    return <div className="mx-auto max-w-3xl px-4 py-6">{children}</div>;
  }

  return (
    <>
      <NavBar />
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </>
  );
}
