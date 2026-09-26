"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export default function NavBar() {
  const { data: session, status } = useSession();

  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Dogfood
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/gallery" className="hover:text-accent">Gallery</Link>
          {status === "authenticated" ? (
            <>
              <Link href="/dashboard" className="hover:text-accent">Dashboard</Link>
              <span className="rounded-full bg-accentSoft px-3 py-1 text-xs text-accent">
                {session.user.role}
              </span>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-ink/70 hover:text-ink"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-accent">Log in</Link>
              <Link
                href="/register"
                className="rounded-md bg-accent px-3 py-1.5 text-white hover:opacity-90"
              >
                Register
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
