import { z } from "zod";
import { DEFAULT_CURRENCY, SPLIT_MODES } from "./constants.js";

/** Zod schema for supported split modes */
export const splitModeSchema = z.enum(SPLIT_MODES);

/** Zod schema for an individual participant split input */
export const billSplitInputSchema = z.object({
  participant: z.string().trim().min(1, "Participant name is required"),
  amount: z
    .number()
    .finite("Split amount must be a finite number")
    .nonnegative("Split amount cannot be negative")
    .optional(),
  percentage: z
    .number()
    .finite("Percentage must be a finite number")
    .min(0, "Percentage cannot be negative")
    .max(100, "Percentage cannot exceed 100")
    .optional(),
  settled: z.boolean().optional(),
});

/** Inferred type for bill split input */
export type BillSplitInput = z.infer<typeof billSplitInputSchema>;

/** Zod schema for creating a bill */
export const createBillSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120),
    totalAmount: z
      .number()
      .finite("Total amount must be a valid number")
      .positive("Total amount must be greater than zero"),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO 4217 code")
      .default(DEFAULT_CURRENCY),
    participants: z
      .array(z.string().trim().min(1, "Participant name is required"))
      .min(1, "At least one participant is required"),
    paidBy: z.string().trim().min(1, "Payer is required"),
    splitMode: splitModeSchema.default("equal"),
    group: z
      .string()
      .trim()
      .max(60, "Group name must be 60 characters or fewer")
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    splits: z.array(billSplitInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    // 1. Unique participants check
    const uniqueParticipants = new Set(data.participants);
    if (uniqueParticipants.size !== data.participants.length) {
      ctx.addIssue({
        code: "custom",
        message: "Participants must be unique",
        path: ["participants"],
      });
    }

    // 2. Payer must be in participants
    if (!data.participants.includes(data.paidBy)) {
      ctx.addIssue({
        code: "custom",
        message: "Payer must be one of the participants",
        path: ["paidBy"],
      });
    }

    // 3. Exact split mode validation
    if (data.splitMode === "exact") {
      if (!data.splits || data.splits.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Splits are required for exact split mode",
          path: ["splits"],
        });
        return;
      }

      const splitParticipants = new Set(data.splits.map((s) => s.participant));
      if (
        splitParticipants.size !== data.splits.length ||
        splitParticipants.size !== data.participants.length ||
        !data.participants.every((p) => splitParticipants.has(p))
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Splits must cover all participants without duplicates",
          path: ["splits"],
        });
        return;
      }

      let sum = 0;
      for (const s of data.splits) {
        if (s.amount === undefined || !Number.isFinite(s.amount) || s.amount < 0) {
          ctx.addIssue({
            code: "custom",
            message: "Every participant must have a non-negative amount",
            path: ["splits"],
          });
          return;
        }
        sum += s.amount;
      }

      if (Math.abs(sum - data.totalAmount) > 0.01) {
        ctx.addIssue({
          code: "custom",
          message: "Sum of exact splits must equal total amount",
          path: ["splits"],
        });
      }
      return;
    }

    // 4. Percentage split mode validation
    if (data.splitMode === "percentage") {
      if (!data.splits || data.splits.length === 0) {
        ctx.addIssue({
          code: "custom",
          message: "Splits are required for percentage split mode",
          path: ["splits"],
        });
        return;
      }

      const splitParticipants = new Set(data.splits.map((s) => s.participant));
      if (
        splitParticipants.size !== data.splits.length ||
        splitParticipants.size !== data.participants.length ||
        !data.participants.every((p) => splitParticipants.has(p))
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Splits must cover all participants without duplicates",
          path: ["splits"],
        });
        return;
      }

      let sumPct = 0;
      for (const s of data.splits) {
        if (
          s.percentage === undefined ||
          !Number.isFinite(s.percentage) ||
          s.percentage < 0 ||
          s.percentage > 100
        ) {
          ctx.addIssue({
            code: "custom",
            message: "Every participant must have a percentage between 0 and 100",
            path: ["splits"],
          });
          return;
        }
        sumPct += s.percentage;
      }

      if (Math.abs(sumPct - 100) > 0.01) {
        ctx.addIssue({
          code: "custom",
          message: "Sum of percentage splits must equal 100%",
          path: ["splits"],
        });
      }
      return;
    }

    // 5. Equal split mode with splits provided
    if (data.splitMode === "equal" && data.splits) {
      const splitParticipants = new Set(data.splits.map((s) => s.participant));
      if (
        splitParticipants.size !== data.splits.length ||
        splitParticipants.size !== data.participants.length ||
        !data.participants.every((p) => splitParticipants.has(p))
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Splits must match participants",
          path: ["splits"],
        });
      }
    }
  });

/** Inferred type for creating a bill */
export type CreateBillInput = z.infer<typeof createBillSchema>;

/** Zod schema for updating a bill */
export const updateBillSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120).optional(),
    totalAmount: z
      .number()
      .finite("Total amount must be a valid number")
      .positive("Total amount must be greater than zero")
      .optional(),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO 4217 code")
      .optional(),
    participants: z
      .array(z.string().trim().min(1, "Participant name is required"))
      .min(1, "At least one participant is required")
      .optional(),
    paidBy: z.string().trim().min(1, "Payer is required").optional(),
    splitMode: splitModeSchema.optional(),
    group: z
      .string()
      .trim()
      .max(60, "Group name must be 60 characters or fewer")
      .nullable()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : null)),
    splits: z.array(billSplitInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.participants) {
      if (new Set(data.participants).size !== data.participants.length) {
        ctx.addIssue({
          code: "custom",
          message: "Participants must be unique",
          path: ["participants"],
        });
      }
      if (data.paidBy && !data.participants.includes(data.paidBy)) {
        ctx.addIssue({
          code: "custom",
          message: "Payer must be one of the participants",
          path: ["paidBy"],
        });
      }
    }

    if ((data.splitMode === "exact" || data.splitMode === "percentage") && !data.splits) {
      ctx.addIssue({
        code: "custom",
        message: `Splits are required when splitMode is ${data.splitMode}`,
        path: ["splits"],
      });
      return;
    }

    if (data.splits && data.participants) {
      const splitParts = new Set(data.splits.map((s) => s.participant));
      if (
        splitParts.size !== data.splits.length ||
        splitParts.size !== data.participants.length ||
        !data.participants.every((p) => splitParts.has(p))
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Splits must cover all participants without duplicates",
          path: ["splits"],
        });
      }
    }

    if (
      data.splits &&
      (data.splitMode === "exact" || (!data.splitMode && data.totalAmount !== undefined))
    ) {
      if (data.totalAmount !== undefined) {
        const sum = data.splits.reduce((acc, s) => acc + (s.amount ?? 0), 0);
        if (Math.abs(sum - data.totalAmount) > 0.01) {
          ctx.addIssue({
            code: "custom",
            message: "Sum of exact splits must equal total amount",
            path: ["splits"],
          });
        }
      }
    }

    if (data.splits && data.splitMode === "percentage") {
      const sumPct = data.splits.reduce((acc, s) => acc + (s.percentage ?? 0), 0);
      if (Math.abs(sumPct - 100) > 0.01) {
        ctx.addIssue({
          code: "custom",
          message: "Sum of percentage splits must equal 100%",
          path: ["splits"],
        });
      }
    }
  });

/** Inferred type for updating a bill */
export type UpdateBillInput = z.infer<typeof updateBillSchema>;

/** Zod schema for settling a participant's share */
export const settleBillSchema = z.object({
  participant: z.string().trim().min(1, "Participant name is required"),
  settled: z.boolean(),
});

/** Inferred type for settling a bill */
export type SettleBillInput = z.infer<typeof settleBillSchema>;

/** Zod schema for sharing a bill */
export const shareBillSchema = z.object({
  enabled: z.boolean(),
  rotate: z.boolean().optional(),
});

/** Inferred type for sharing a bill */
export type ShareBillInput = z.infer<typeof shareBillSchema>;
