import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);

    const data = new FormData(event.currentTarget);
    const email = String(data.get("email"));
    const password = String(data.get("password"));
    const result =
      mode === "sign-up"
        ? await authClient.signUp.email({
            name: String(data.get("name")),
            email,
            password,
          })
        : await authClient.signIn.email({ email, password });

    setPending(false);
    if (result.error) {
      setError(result.error.message ?? "Authentication failed");
      return;
    }

    await navigate({ to: "/" });
  }

  async function handleGoogleSignIn() {
    setError("");
    setPending(true);

    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: `${window.location.origin}/`,
    });

    if (result.error) {
      setError(result.error.message ?? "Google sign-in failed");
      setPending(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-xl border bg-card p-6 shadow-sm">
      <h2 className="text-2xl font-bold">
        {mode === "sign-in" ? "Welcome back" : "Create your account"}
      </h2>
      <p className="mt-1 text-muted-foreground">
        {mode === "sign-in"
          ? "Sign in to manage your bills."
          : "Start splitting expenses securely."}
      </p>

      <button
        className="mt-6 flex min-h-11 w-full items-center justify-center gap-3 rounded-md border bg-background px-4 font-semibold hover:bg-muted disabled:opacity-60"
        type="button"
        disabled={pending}
        onClick={() => void handleGoogleSignIn()}
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="my-5 flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs font-medium uppercase text-muted-foreground">or</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        {mode === "sign-up" && (
          <label className="block font-medium">
            Name
            <input
              className="mt-1 min-h-11 w-full rounded-md border bg-background px-3"
              name="name"
              autoComplete="name"
              required
            />
          </label>
        )}
        <label className="block font-medium">
          Email
          <input
            className="mt-1 min-h-11 w-full rounded-md border bg-background px-3"
            name="email"
            type="email"
            autoComplete="email"
            required
          />
        </label>
        <label className="block font-medium">
          Password
          <input
            className="mt-1 min-h-11 w-full rounded-md border bg-background px-3"
            name="password"
            type="password"
            minLength={8}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            required
          />
        </label>

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <button
          className="min-h-11 w-full rounded-md bg-primary px-4 font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
          type="submit"
          disabled={pending}
        >
          {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Sign up"}
        </button>
      </form>

      <button
        className="mt-4 min-h-11 w-full text-sm font-medium text-primary"
        type="button"
        onClick={() => {
          setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          setError("");
        }}
      >
        {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
      </button>
    </section>
  );
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.92h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.32 2.98-7.41Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.98-.9 6.63-2.43l-3.24-2.53c-.9.6-2.05.96-3.39.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.61A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.39 13.87A6 6 0 0 1 6.08 12c0-.65.11-1.28.31-1.87V7.52H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.48l3.35-2.61Z"
      />
      <path
        fill="#EA4335"
        d="M12 6c1.47 0 2.79.51 3.82 1.5l2.88-2.88A9.65 9.65 0 0 0 12 2a10 10 0 0 0-8.96 5.52l3.35 2.61C7.18 7.76 9.39 6 12 6Z"
      />
    </svg>
  );
}
