import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: HomePage,
});

function HomePage() {
  return (
    <div>
      <h2 style={{ marginBottom: "var(--space-md)" }}>Welcome to Bill Splitter</h2>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-lg)" }}>
        Split bills easily with friends, family, and groups.
      </p>

      <div
        style={{
          padding: "var(--space-lg)",
          backgroundColor: "var(--color-surface)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-md)",
        }}
      >
        <h3 style={{ marginBottom: "var(--space-sm)" }}>Get Started</h3>
        <p style={{ color: "var(--color-text-muted)" }}>
          Create a new bill and add participants to start splitting.
        </p>
      </div>
    </div>
  );
}
