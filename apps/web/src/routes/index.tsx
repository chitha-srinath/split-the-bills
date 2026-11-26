import type { Bill } from "@bill-splitter/shared";
import { barY, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { useForm } from "@tanstack/react-form";
import { Link, createFileRoute } from "@tanstack/react-router";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { authClient } from "../lib/auth-client";

export const Route = createFileRoute("/")({
  component: HomePage,
});

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

const features = tableFeatures({});
const columnHelper = createColumnHelper<typeof features, Bill>();
const columns = columnHelper.columns([
  columnHelper.accessor("title", { header: "Bill" }),
  columnHelper.accessor("totalAmount", {
    header: "Total",
    cell: ({ getValue }) => currency.format(getValue()),
  }),
  columnHelper.accessor("participants", {
    header: "People",
    cell: ({ getValue }) => getValue().length,
  }),
  columnHelper.accessor("splitAmount", {
    header: "Per person",
    cell: ({ getValue }) => currency.format(getValue()),
  }),
]);

function HomePage() {
  const { data: session, isPending: sessionPending } = authClient.useSession();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBills = useCallback(async () => {
    if (!session) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const response = await fetch("/api/bills", { credentials: "include" });
    if (!response.ok) {
      setError("Could not load your bills.");
      setLoading(false);
      return;
    }

    const body = (await response.json()) as { bills: Bill[] };
    setBills(body.bills);
    setError("");
    setLoading(false);
  }, [session]);

  useEffect(() => {
    void loadBills();
  }, [loadBills]);

  if (sessionPending) {
    return <p className="text-muted-foreground">Loading your workspace…</p>;
  }

  if (!session) {
    return (
      <section className="mx-auto max-w-2xl py-16 text-center">
        <p className="font-semibold text-primary">Simple, fair, transparent</p>
        <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
          Split expenses without the awkward maths.
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
          Create bills, divide costs among friends, and keep every shared expense in one place.
        </p>
        <Link
          to="/auth"
          className="mt-8 inline-flex min-h-11 items-center rounded-md bg-primary px-5 font-semibold text-primary-foreground hover:no-underline hover:opacity-90"
        >
          Get started
        </Link>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold text-primary">Your workspace</p>
        <h2 className="mt-1 text-3xl font-bold tracking-tight">Bill dashboard</h2>
        <p className="mt-2 text-muted-foreground">
          Add an expense and see how your shared spending is distributed.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <BillForm
          onCreated={(bill) => {
            setBills((current) => [bill, ...current]);
            setError("");
          }}
          onError={setError}
        />
        <SpendingChart bills={bills} />
      </div>

      <BillsTable bills={bills} loading={loading} />
    </div>
  );
}

function BillForm({
  onCreated,
  onError,
}: {
  onCreated: (bill: Bill) => void;
  onError: (message: string) => void;
}) {
  const form = useForm({
    defaultValues: { title: "", totalAmount: 0, participants: "" },
    onSubmit: async ({ value, formApi }) => {
      const participants = value.participants
        .split(",")
        .map((participant) => participant.trim())
        .filter(Boolean);

      const response = await fetch("/api/bills", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: value.title.trim(),
          totalAmount: value.totalAmount,
          participants,
        }),
      });

      if (!response.ok) {
        onError("Could not create the bill. Check the entered values and try again.");
        return;
      }

      onCreated((await response.json()) as Bill);
      formApi.reset();
    },
  });

  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="text-lg font-semibold">Add a bill</h3>
      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field
          name="title"
          validators={{
            onBlur: ({ value }) => (value.trim() ? undefined : "Enter a bill title"),
          }}
        >
          {(field) => (
            <Field label="Title" error={field.state.meta.errors.join(", ")}>
              <input
                className="min-h-11 w-full rounded-md border bg-background px-3"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Dinner"
                required
              />
            </Field>
          )}
        </form.Field>

        <form.Field
          name="totalAmount"
          validators={{
            onChange: ({ value }) => (value > 0 ? undefined : "Amount must be greater than zero"),
          }}
        >
          {(field) => (
            <Field label="Total amount" error={field.state.meta.errors.join(", ")}>
              <input
                className="min-h-11 w-full rounded-md border bg-background px-3"
                name={field.name}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={field.state.value || ""}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.valueAsNumber)}
                placeholder="0.00"
                required
              />
            </Field>
          )}
        </form.Field>

        <form.Field
          name="participants"
          validators={{
            onBlur: ({ value }) => (value.trim() ? undefined : "Add at least one participant"),
          }}
        >
          {(field) => (
            <Field label="Participants" error={field.state.meta.errors.join(", ")}>
              <input
                className="min-h-11 w-full rounded-md border bg-background px-3"
                name={field.name}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                placeholder="Asha, Ravi, Maya"
                aria-describedby="participants-hint"
                required
              />
              <span id="participants-hint" className="text-xs text-muted-foreground">
                Separate names with commas.
              </span>
            </Field>
          )}
        </form.Field>

        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
          {([canSubmit, isSubmitting]) => (
            <button
              className="min-h-11 w-full rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-60"
              type="submit"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? "Saving…" : "Add bill"}
            </button>
          )}
        </form.Subscribe>
      </form>
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1 text-sm font-medium">
      {label}
      {children}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  );
}

function SpendingChart({ bills }: { bills: Bill[] }) {
  const data = useMemo(
    () =>
      bills.slice(0, 8).map((bill) => ({
        name: bill.title.length > 12 ? `${bill.title.slice(0, 12)}…` : bill.title,
        amount: bill.totalAmount,
      })),
    [bills],
  );
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          barY(data, {
            x: "name",
            y: "amount",
            fill: "var(--primary)",
            inset: 2,
          }),
        ],
        scales: {
          x: {
            scale: () => scaleBand<string>().padding(0.18),
          },
          y: {
            scale: scaleLinear,
            nice: true,
            grid: true,
            axis: {
              label: "Amount",
              ticks: { format: (value) => currency.format(value) },
            },
          },
        },
        svgAnimation: true,
        tooltip,
      }),
    [data],
  );

  return (
    <section className="min-w-0 rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="text-lg font-semibold">Recent spending</h3>
      <p className="text-sm text-muted-foreground">Your eight most recent bills.</p>
      <div className="mt-4 h-72" aria-label="Bar chart of recent bill totals">
        {data.length ? (
          <Chart definition={definition} height={288} ariaLabel="Recent bill totals" />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">
            Add your first bill to see spending insights.
          </div>
        )}
      </div>
    </section>
  );
}

function BillsTable({ bills, loading }: { bills: Bill[]; loading: boolean }) {
  const table = useTable({ features, columns, data: bills });
  const rows = table.getRowModel().rows;
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 52,
    overscan: 6,
    useFlushSync: false,
  });

  return (
    <section className="overflow-hidden rounded-xl border bg-card shadow-sm">
      <div className="border-b p-5">
        <h3 className="text-lg font-semibold">Bill history</h3>
        <p className="text-sm text-muted-foreground">
          {bills.length} {bills.length === 1 ? "bill" : "bills"} recorded
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[640px]" role="table" aria-label="Bill history">
          <div className="grid grid-cols-[2fr_1fr_0.7fr_1fr] border-b bg-muted/50" role="row">
            {table.getHeaderGroups()[0]?.headers.map((header) => (
              <div
                className="px-4 py-3 text-left text-xs font-semibold uppercase"
                role="columnheader"
                key={header.id}
              >
                <table.FlexRender header={header} />
              </div>
            ))}
          </div>

          <div ref={scrollRef} className="max-h-80 overflow-auto" role="rowgroup">
            {loading ? (
              <p className="p-5 text-sm text-muted-foreground">Loading bills…</p>
            ) : rows.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No bills yet.</p>
            ) : (
              <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
                {virtualizer.getVirtualItems().map((virtualRow) => {
                  const row = rows[virtualRow.index];
                  return (
                    <div
                      className="absolute left-0 top-0 grid w-full grid-cols-[2fr_1fr_0.7fr_1fr] border-b text-sm"
                      role="row"
                      key={row.id}
                      style={{
                        height: virtualRow.size,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {row.getAllCells().map((cell) => (
                        <div className="truncate px-4 py-4" role="cell" key={cell.id}>
                          <table.FlexRender cell={cell} />
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
