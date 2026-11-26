import type { FastifyInstance } from "fastify";
import type { Bill, CreateBillInput } from "@bill-splitter/shared";

// In-memory store for now
const bills: Bill[] = [];
let nextId = 1;

export async function billsRoute(app: FastifyInstance) {
  // GET /api/bills — list all bills
  app.get("/bills", async () => {
    return { bills };
  });

  // GET /api/bills/:id — get a single bill
  app.get<{ Params: { id: string } }>("/bills/:id", async (request, reply) => {
    const bill = bills.find((b) => b.id === request.params.id);
    if (!bill) {
      return reply.status(404).send({ error: "Bill not found" });
    }
    return bill;
  });

  // POST /api/bills — create a new bill
  app.post<{ Body: CreateBillInput }>("/bills", async (request, reply) => {
    const { title, totalAmount, participants } = request.body;

    if (!title || !totalAmount || !participants?.length) {
      return reply.status(400).send({ error: "Missing required fields" });
    }

    const splitAmount = totalAmount / participants.length;

    const bill: Bill = {
      id: String(nextId++),
      title,
      totalAmount,
      participants,
      splitAmount,
      createdAt: new Date().toISOString(),
    };

    bills.push(bill);
    return reply.status(201).send(bill);
  });

  // DELETE /api/bills/:id — delete a bill
  app.delete<{ Params: { id: string } }>(
    "/bills/:id",
    async (request, reply) => {
      const index = bills.findIndex((b) => b.id === request.params.id);
      if (index === -1) {
        return reply.status(404).send({ error: "Bill not found" });
      }
      bills.splice(index, 1);
      return { success: true };
    },
  );
}
