"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { ApiRequestError } from "@/lib/api/client";
import { registerUser } from "@/lib/api/auth";
import type { UserRole } from "@/lib/api/types";

const REGISTER_ROLE: UserRole = "CLIENT";

export default function RegisterPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): string | null {
    if (!name.trim()) {
      return "Enter your name to continue.";
    }

    if (!email.trim()) {
      return "Enter your email to continue.";
    }

    if (password.length < 8) {
      return "Your password must be at least 8 characters long.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validationError = validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      await registerUser({
        email: email.trim(),
        password,
        role: REGISTER_ROLE,
      });

      router.replace("/login");
    } catch (requestError) {
      if (requestError instanceof ApiRequestError) {
        if (requestError.status === 409) {
          setError("An account with this email already exists. Try signing in instead.");
        } else if (requestError.status === 422) {
          setError("Please check your details. Your password must be at least 8 characters long.");
        } else {
          setError(requestError.detail);
        }
      } else if (requestError instanceof Error) {
        setError(requestError.message);
      } else {
        setError("We could not create your account. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f4f1eb] text-[#1d2a25]">
      <div className="mx-auto grid min-h-screen max-w-7xl lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden flex-col justify-between bg-[#183c31] p-10 text-[#f4f1eb] lg:flex xl:p-14">
          <Link
            href="/"
            className="text-2xl font-black tracking-[-0.08em]"
          >
            banora<span className="text-[#e26d42]">.</span>
          </Link>

          <div className="max-w-md">
            <p className="mb-6 text-xs font-bold uppercase tracking-[0.24em] text-[#f0b39b]">
              Banora workspace
            </p>

            <h1 className="text-6xl font-black leading-[0.94] tracking-[-0.07em]">
              Build trust around every project.
            </h1>

            <p className="mt-7 max-w-sm text-lg leading-8 text-[#c6d3cc]">
              Manage your work, discover trusted contractors, and keep
              construction conversations in one place.
            </p>
          </div>

          <p className="text-xs uppercase tracking-[0.18em] text-[#91aaa0]">
            Trusted work, clearly presented.
          </p>
        </section>

        <section className="flex items-center justify-center px-5 py-10 sm:px-10">
          <div className="w-full max-w-md">
            <div className="mb-12 flex items-center justify-between lg:hidden">
              <Link
                href="/"
                className="text-2xl font-black tracking-[-0.08em] text-[#183c31]"
              >
                banora<span className="text-[#e26d42]">.</span>
              </Link>

              <Link
                href="/"
                className="text-sm font-bold text-[#607068]"
              >
                Back home
              </Link>
            </div>

            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#e26d42]">
              Create account
            </p>

            <h2 className="mt-4 text-4xl font-black tracking-[-0.06em] text-[#183c31] sm:text-5xl">
              Get started on Banora.
            </h2>

            <p className="mt-4 text-base leading-7 text-[#607068]">
              Create a client account to manage projects and reach trusted
              contractors.
            </p>

            <form
              className="mt-10 space-y-5"
              onSubmit={handleSubmit}
            >
              <label className="block text-sm font-bold text-[#365048]">
                Name

                <input
                  className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-white px-4 py-3.5 text-base font-medium outline-none transition placeholder:text-[#a1aaa3] focus:border-[#183c31] focus:ring-2 focus:ring-[#dce7df]"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your full name"
                />
              </label>

              <label className="block text-sm font-bold text-[#365048]">
                Email

                <input
                  className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-white px-4 py-3.5 text-base font-medium outline-none transition placeholder:text-[#a1aaa3] focus:border-[#183c31] focus:ring-2 focus:ring-[#dce7df]"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@company.com"
                />
              </label>

              <label className="block text-sm font-bold text-[#365048]">
                Password

                <input
                  className="mt-2 w-full rounded-xl border border-[#cdd2cb] bg-white px-4 py-3.5 text-base font-medium outline-none transition placeholder:text-[#a1aaa3] focus:border-[#183c31] focus:ring-2 focus:ring-[#dce7df]"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="At least 8 characters"
                />
              </label>

              {error && (
                <p
                  className="rounded-xl border border-[#e8b9a8] bg-[#fff3ed] px-4 py-3 text-sm font-semibold text-[#a3482d]"
                  role="alert"
                >
                  {error}
                </p>
              )}

              <button
                className="w-full rounded-xl bg-[#e26d42] px-5 py-4 text-sm font-black text-white transition hover:bg-[#c95731] disabled:cursor-not-allowed disabled:opacity-60"
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Creating your account..." : "Create account"}
              </button>
            </form>

            <p className="mt-8 text-sm font-bold text-[#607068]">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-[#e26d42] transition hover:text-[#c95731]"
              >
                Sign in
              </Link>
            </p>

            <Link
              href="/"
              className="mt-4 inline-block text-sm font-bold text-[#607068] transition hover:text-[#183c31]"
            >
              ← Return to home
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
