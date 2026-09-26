"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [code, setCode] = useState("");
  const [devModeCode, setDevModeCode] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  async function attemptLogin() {
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    return result;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await attemptLogin();
    setLoading(false);

    if (result?.ok) {
      router.push("/dashboard");
      return;
    }

    const statusRes = await fetch("/api/auth/needs-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const status = await statusRes.json();

    if (status.needsVerification) {
      setNeedsVerification(true);
      const resendRes = await fetch("/api/register/resend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const resendData = await resendRes.json();
      setDevModeCode(resendData.devModeCode ?? null);
    } else {
      setError("Incorrect email or password");
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, code }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error);
      setLoading(false);
      return;
    }

    const result = await attemptLogin();
    setLoading(false);

    if (result?.ok) {
      router.push("/dashboard");
    } else {
      setError(
        "Verified, but login failed — check your password and try again.",
      );
      setNeedsVerification(false);
    }
  }

  async function handleResend() {
    setError(null);
    setVerifyMessage(null);
    const res = await fetch("/api/register/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setDevModeCode(data.devModeCode ?? null);
    setVerifyMessage("A new code has been sent.");
  }

  if (needsVerification) {
    return (
      <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-6">
        <div className="w-full max-w-sm animate-[slideIn_0.4s_ease-out]">
          <h1 className="text-3xl font-semibold">Verify your email</h1>
          <p className="mt-2 text-sm text-muted">
            Your account for <strong className="text-ink">{email}</strong>{" "}
            hasn't been verified yet. We just sent a new code.
          </p>

          {devModeCode && (
            <p className="mt-4 rounded-md border border-signal/30 bg-signal/10 p-3 text-xs text-signal">
              No email provider is configured — here's the code directly
              (dev/demo mode):{" "}
              <code className="font-mono text-sm">{devModeCode}</code>
            </p>
          )}

          <form onSubmit={handleVerify} className="mt-8 space-y-4">
            <input
              required
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full rounded-md border border-line bg-surface px-3 py-3 text-center text-lg tracking-[0.5em] text-ink placeholder:text-muted focus:border-signal focus:outline-none"
            />
            {error && <p className="text-sm text-red-400">{error}</p>}
            {verifyMessage && (
              <p className="text-sm text-signal">{verifyMessage}</p>
            )}
            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded-md bg-signal px-3 py-3 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-40"
            >
              {loading ? "Verifying…" : "Verify and log in"}
            </button>
            <button
              type="button"
              onClick={handleResend}
              className="w-full text-xs text-muted hover:text-signal"
            >
              Didn't get a code? Resend
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-6">
      <div className="w-full max-w-sm animate-[slideIn_0.4s_ease-out]">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome back!</h1>
        <p className="mt-2 text-sm text-muted">
          Log in to manage your events and submissions.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted">
              Email
            </label>
            <input
              required
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-signal focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted">
              Password
            </label>
            <input
              required
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-signal focus:outline-none"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-signal px-3 py-2.5 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Logging in…" : "Login"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Don't have an account?{" "}
          <Link href="/register" className="text-signal hover:underline">
            Sign Up
          </Link>
        </p>
      </div>
    </div>
  );
}
