import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/router-devtools";
import { LogOut, ReceiptText, Sparkles } from "lucide-react";

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
      <div className="app-shell">
        <header className="app-header sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex min-h-16 w-full max-w-7xl items-center gap-5 px-4 sm:px-6 lg:px-8">
            <Link
              to="/"
              className="group flex items-center gap-2.5 text-foreground hover:no-underline"
            >
              <span className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground transition-transform group-hover:-rotate-3">
                <ReceiptText className="size-5" />
              </span>
              <span className="text-lg font-bold tracking-tight">Splitly</span>
            </Link>

            <nav className="app-nav hidden items-center sm:flex" aria-label="Primary navigation">
              <Link
                to="/"
                className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground hover:no-underline"
                activeProps={{ className: "bg-muted text-foreground" }}
              >
                Dashboard
              </Link>
              <Link
                to="/about"
                className="rounded-full px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground hover:no-underline"
                activeProps={{ className: "bg-muted text-foreground" }}
              >
                About
              </Link>
            </nav>

            <div className="ml-auto flex items-center gap-2">
              {!isPending &&
                (session ? (
                  <>
                    <div className="hidden items-center gap-2 rounded-full border bg-card/70 py-1 pl-1 pr-3 sm:flex">
                      <span className="grid size-7 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {session.user.name?.charAt(0).toUpperCase() || "U"}
                      </span>
                      <span className="max-w-28 truncate text-sm font-medium">
                        {session.user.name}
                      </span>
                    </div>
                    <button
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted"
                      type="button"
                      onClick={() => void authClient.signOut()}
                    >
                      <LogOut className="size-4" />
                      <span className="hidden md:inline">Sign out</span>
                    </button>
                  </>
                ) : (
                  <Link to="/auth" className="app-auth-link">
                    <Sparkles className="size-4" />
                    Sign in
                  </Link>
                ))}
              <ModeToggle />
            </div>
          </div>
        </header>

        <main className="app-main">
          <Outlet />
        </main>
      </div>

      <TanStackRouterDevtools />
    </ThemeProvider>
  );
}
