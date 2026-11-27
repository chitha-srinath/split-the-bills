import type { Bill } from "@bill-splitter/core";
import { barY, defineChart } from "@tanstack/charts";
import { Chart } from "@tanstack/charts/react";
import { scaleBand } from "@tanstack/charts/scales/band";
import { scaleLinear } from "@tanstack/charts/scales/linear";
import { tooltip } from "@tanstack/charts/tooltip";
import { useForm } from "@tanstack/react-form";
import { Link, createFileRoute } from "@tanstack/react-router";
import { createColumnHelper, tableFeatures, useTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ArrowRight,
  BarChart3,
  Check,
  Plus,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
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

function LandingPreview() {
  return (
    <div className="relative mx-auto w-full max-w-lg lg:mx-0">
      <div className="rotate-1 rounded-xl border bg-card/90 p-3 shadow-xl backdrop-blur transition-transform duration-500 hover:rotate-0">
        <div className="rounded-lg border bg-background/70 p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Weekend in Goa</p>
              <p className="mt-1 text-3xl font-black tracking-tight">₹12,480</p>
            </div>
            <span className="grid size-11 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <ShieldCheck className="size-6" />
            </span>
          </div>

          <div className="mt-7 space-y-3">
            {[
              ["Beach house", "₹7,200", "bg-violet-500"],
              ["Dinner", "₹3,280", "bg-cyan-500"],
              ["Taxi", "₹2,000", "bg-amber-500"],
            ].map(([name, amount, color]) => (
              <div className="flex items-center gap-3 rounded-xl border bg-card p-3" key={name}>
                <span className={`size-2.5 rounded-full ${color}`} />
                <span className="font-medium">{name}</span>
                <span className="ml-auto font-bold">{amount}</span>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-2xl bg-primary p-4 text-primary-foreground">
            <div className="flex items-center justify-between text-sm opacity-80">
              <span>Split between 4 friends</span>
              <Users className="size-4" />
            </div>
            <div className="mt-2 flex items-end justify-between">
              <span className="font-medium">Each person pays</span>
              <span className="text-2xl font-black">₹3,120</span>
            </div>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-5 -left-4 flex items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm font-semibold shadow-lg sm:-left-8">
        <span className="grid size-7 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
          <Check className="size-4" />
        </span>
        Everyone is settled
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ReceiptText;
  label: string;
  value: string;
}) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border bg-card/80 p-5 shadow-sm">
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="truncate text-xl font-black tracking-tight">{value}</p>
      </div>
    </article>
  );
}

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
      <div className="pb-10">
        <section className="grid items-center gap-14 py-10 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1.5 text-sm font-semibold text-primary">
              <Sparkles className="size-4" />
              Shared expenses, finally made simple
            </div>
            <h2 className="mt-6 text-balance text-5xl font-black tracking-[-0.045em] sm:text-6xl lg:text-7xl">
              Split the bill.
              <span className="block text-primary">Keep the friendship.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-muted-foreground sm:text-xl">
              From chai runs to group getaways, Splitly keeps every expense clear, fair, and
              effortlessly organized.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/auth"
                className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 font-bold text-primary-foreground shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 hover:no-underline hover:shadow-primary/30"
              >
                Start splitting free
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex min-h-12 items-center justify-center rounded-xl border bg-card/70 px-6 font-semibold text-foreground transition-colors hover:bg-muted hover:no-underline"
              >
                See how it works
              </a>
            </div>
            <div className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              {["No spreadsheets", "Fair splits", "Secure by default"].map((item) => (
                <span className="flex items-center gap-1.5" key={item}>
                  <Check className="size-4 text-emerald-500" /> {item}
                </span>
              ))}
            </div>
          </div>

          <LandingPreview />
        </section>

        <section id="how-it-works" className="grid gap-4 scroll-mt-24 sm:grid-cols-3">
          {[
            [ReceiptText, "Add the expense", "Record the total and what it was for in seconds."],
            [Users, "Choose your people", "Add everyone involved and split the amount evenly."],
            [
              BarChart3,
              "Stay in the clear",
              "See recent spending and every bill in one tidy view.",
            ],
          ].map(([Icon, title, copy], index) => {
            const FeatureIcon = Icon as typeof ReceiptText;
            return (
              <article
                className="rounded-2xl border bg-card/70 p-6 shadow-sm backdrop-blur transition-all hover:-translate-y-1 hover:shadow-lg"
                key={title as string}
              >
                <div className="flex items-center justify-between">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <FeatureIcon className="size-5" />
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
                </div>
                <h3 className="mt-5 text-lg font-bold">{title as string}</h3>
                <p className="mt-2 leading-6 text-muted-foreground">{copy as string}</p>
              </article>
            );
          })}
        </section>
      </div>
    );
  }

  const totalSpent = bills.reduce((total, bill) => total + bill.totalAmount, 0);
  const peopleCount = new Set(bills.flatMap((bill) => bill.participants)).size;

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-semibold text-primary">Your workspace</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Good to see you.</h2>
          <p className="mt-2 text-muted-foreground">
            Here is the latest picture of your shared spending.
          </p>
        </div>
        <a
          href="#new-bill"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 font-semibold text-primary-foreground hover:no-underline"
        >
          <Plus className="size-4" /> New bill
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={WalletCards} label="Total recorded" value={currency.format(totalSpent)} />
        <StatCard icon={ReceiptText} label="Bills created" value={String(bills.length)} />
        <StatCard icon={Users} label="People included" value={String(peopleCount)} />
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
    <section
      id="new-bill"
      className="scroll-mt-24 rounded-2xl border bg-card/90 p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <Plus className="size-5" />
        </span>
        <div>
          <h3 className="text-lg font-bold">Add a bill</h3>
          <p className="text-sm text-muted-foreground">Split a new shared expense.</p>
        </div>
      </div>
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
    <section className="min-w-0 rounded-2xl border bg-card/90 p-5 shadow-sm sm:p-6">
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
    <section className="overflow-hidden rounded-2xl border bg-card/90 shadow-sm">
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
