import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@bill-splitter/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bill-splitter/ui/components/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@bill-splitter/ui/components/field";
import { Input } from "@bill-splitter/ui/components/input";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    <Card className="auth-card">
      <CardHeader className="auth-card-header">
        <span className="auth-lock" aria-hidden="true">
          <LockKeyhole size={20} />
        </span>
        <CardTitle className="auth-title">
          {mode === "sign-in" ? "Welcome back" : "Create your account"}
        </CardTitle>
        <CardDescription>
          {mode === "sign-in"
            ? "Sign in to continue to Splitly."
            : "Start managing shared expenses."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Button
          className="auth-google"
          variant="outline"
          size="lg"
          type="button"
          disabled={pending}
          onClick={() => void handleGoogleSignIn()}
        >
          <GoogleIcon /> Continue with Google
        </Button>

        <FieldSeparator className="auth-divider">or</FieldSeparator>

        <form className="auth-form" onSubmit={handleSubmit}>
          <FieldGroup>
            {mode === "sign-up" && (
              <Field>
                <FieldLabel htmlFor="name">Full name</FieldLabel>
                <Input
                  className="auth-input"
                  id="name"
                  name="name"
                  autoComplete="name"
                  placeholder="Aarav Kumar"
                  required
                />
              </Field>
            )}
            <Field>
              <FieldLabel htmlFor="email">Email address</FieldLabel>
              <Input
                className="auth-input"
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <div className="auth-password">
                <Input
                  className="auth-input"
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  minLength={8}
                  autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                  placeholder="At least 8 characters"
                  required
                />
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((value) => !value)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </div>
            </Field>
          </FieldGroup>

          {error && <FieldError className="auth-error">{error}</FieldError>}

          <Button className="auth-submit" size="lg" type="submit" disabled={pending}>
            {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
            {!pending && <ArrowRight size={18} />}
          </Button>
        </form>

        <p className="auth-switch">
          {mode === "sign-in" ? "No account?" : "Already registered?"}
          <Button
            variant="link"
            size="sm"
            type="button"
            onClick={() => {
              setMode(mode === "sign-in" ? "sign-up" : "sign-in");
              setError("");
            }}
          >
            {mode === "sign-in" ? "Sign up" : "Sign in"}
          </Button>
        </p>
      </CardContent>
    </Card>
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
