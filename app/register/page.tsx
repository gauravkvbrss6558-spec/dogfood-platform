"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState<"details" | "verify">("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [devModeCode, setDevModeCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Something went wrong");
      return;
    }

    const data = await res.json();
    setDevModeCode(data.devModeCode ?? null);
    setStep("verify");
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
      setError(data.error ?? "Something went wrong");
      setLoading(false);
      return;
    }

    const loginResult = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setLoading(false);

    if (loginResult?.ok) {
      router.push("/dashboard");
    } else {
      router.push("/login");
    }
  }

  async function handleResend() {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/register/resend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error);
      return;
    }
    setDevModeCode(data.devModeCode ?? null);
    setMessage("A new code has been sent.");
  }

  if (step === "verify") {
    return (
      <div className="flex min-h-[calc(100vh-65px)] items-center justify-center px-6">
        <div className="w-full max-w-sm animate-[slideIn_0.4s_ease-out]">
          <h1 className="text-3xl font-semibold tracking-tight">
            Check your email
          </h1>
          <p className="mt-2 text-sm text-muted">
            We sent a 6-digit code to{" "}
            <strong className="text-ink">{email}</strong>. Enter it below to
            finish creating your account.
          </p>

          {devModeCode && (
            <p className="mt-4 rounded-md border border-signal/30 bg-signal/10 p-3 text-xs text-signal">
              No email provider is configured — here's the code directly
              (dev/demo mode only):{" "}
              <code className="font-mono text-sm">{devModeCode}</code>
            </p>
          )}

          <form onSubmit={handleVerify} className="mt-8 space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted">
                Verification code
              </label>
              <input
                required
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="123456"
                className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-3 text-center text-lg tracking-[0.5em] text-ink placeholder:text-muted focus:border-signal focus:outline-none"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {message && <p className="text-sm text-signal">{message}</p>}

            <button
              type="submit"
              disabled={loading || code.length !== 6}
              className="w-full rounded-md bg-signal px-3 py-3 text-sm font-medium text-paper transition hover:opacity-90 disabled:opacity-40"
            >
              {loading ? "Verifying…" : "Verify and create account"}
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
        <h1 className="text-3xl font-semibold tracking-tight">Welcome!</h1>
        <p className="mt-2 text-sm text-muted">
          Register as a participant. Organizers can upgrade your role later.
        </p>

        <form onSubmit={handleRegister} className="mt-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted">
              Full name
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-signal focus:outline-none"
            />
          </div>
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
              minLength={8}
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
            {loading ? "Sending code…" : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-signal hover:underline">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
}
