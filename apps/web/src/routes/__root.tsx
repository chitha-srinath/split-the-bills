import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";

import { ModeToggle } from "../components/mode-toggle";
import { ThemeProvider } from "../components/theme-provider";
import { authClient } from "../lib/auth-client";

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const { data: session, isPending } = authClient.useSession();

  return (
    <ThemeProvider>
      <header className="flex min-h-16 items-center gap-6 border-b bg-card px-4 shadow-sm sm:px-8">
        <h1 className="text-xl font-bold">💰 Bill Splitter</h1>
        <nav className="flex items-center gap-4" aria-label="Primary navigation">
          <Link to="/" activeProps={{ className: "font-bold" }}>
            Home
          </Link>
          <Link to="/about" activeProps={{ className: "font-bold" }}>
            About
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          {!isPending &&
            (session ? (
              <>
                <span className="hidden text-sm text-muted-foreground sm:inline">
                  {session.user.name}
                </span>
                <button
                  className="min-h-11 rounded-md border px-3 text-sm font-medium"
                  type="button"
                  onClick={() => authClient.signOut()}
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link to="/auth" className="rounded-md px-3 py-2">
                Sign in
              </Link>
            ))}
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl p-4 sm:p-8">
        <Outlet />
      </main>

      <TanStackRouterDevtools />
    </ThemeProvider>
  );
}
