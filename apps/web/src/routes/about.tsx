import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <div>
      <h2 style={{ marginBottom: "var(--space-md)" }}>About</h2>
      <p style={{ color: "var(--color-text-muted)" }}>
        Bill Splitter is a simple application to help you split expenses fairly
        among friends and groups. Built with Vite, TanStack Router, and Fastify.
      </p>
    </div>
  );
}
