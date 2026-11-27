import { createBillSchema, type Bill } from "@bill-splitter/core";
import type { FastifyInstance } from "fastify";
import { fromNodeHeaders } from "better-auth/node";
import { isValidObjectId } from "mongoose";
import { auth } from "../auth.js";
import { BillModel, type BillDocument } from "../models/bill.js";

function toBill(document: BillDocument & { _id: unknown }): Bill {
  return {
    id: String(document._id),
    title: document.title,
    totalAmount: document.totalAmount,
    participants: document.participants,
    splitAmount: document.splitAmount,
    createdAt: document.createdAt.toISOString(),
  };
}

export async function billsRoute(app: FastifyInstance) {
  app.addHook("preHandler", async (request, reply) => {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session) {
      return reply.status(401).send({ error: "Unauthorized" });
    }

    request.userId = session.user.id;
  });

  app.get("/bills", async (request) => {
    const documents = await BillModel.find({ userId: request.userId })
      .sort({ createdAt: -1 })
      .lean();
    return { bills: documents.map(toBill) };
  });

  app.get<{ Params: { id: string } }>("/bills/:id", async (request, reply) => {
    if (!isValidObjectId(request.params.id)) {
      return reply.status(404).send({ error: "Bill not found" });
    }

    const document = await BillModel.findOne({
      _id: request.params.id,
      userId: request.userId,
    }).lean();
    if (!document) {
      return reply.status(404).send({ error: "Bill not found" });
    }
    return toBill(document);
  });

  app.post<{ Body: unknown }>("/bills", async (request, reply) => {
    const result = createBillSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: "Invalid bill data",
        issues: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    const { title, totalAmount, participants } = result.data;

    const document = await BillModel.create({
      userId: request.userId,
      title,
      totalAmount,
      participants,
      splitAmount: totalAmount / participants.length,
    });

    return reply.status(201).send(toBill(document));
  });

  app.delete<{ Params: { id: string } }>("/bills/:id", async (request, reply) => {
    if (!isValidObjectId(request.params.id)) {
      return reply.status(404).send({ error: "Bill not found" });
    }

    const document = await BillModel.findOneAndDelete({
      _id: request.params.id,
      userId: request.userId,
    });
    if (!document) {
      return reply.status(404).send({ error: "Bill not found" });
    }
    return { success: true };
  });
}
