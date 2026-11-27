import { z } from "zod";

export const createBillSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120),
  totalAmount: z.number().positive("Total amount must be greater than zero"),
  participants: z
    .array(z.string().trim().min(1, "Participant name is required"))
    .min(1, "At least one participant is required"),
});

export type CreateBillInput = z.infer<typeof createBillSchema>;
