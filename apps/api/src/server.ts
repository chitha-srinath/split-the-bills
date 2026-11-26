import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { authClient } from "./auth.js";
import { connectToDatabase, disconnectFromDatabase } from "./database.js";
import { authRoute } from "./routes/auth.js";
import { billsRoute } from "./routes/bills.js";
import { healthRoute } from "./routes/health.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
  credentials: true,
});

await app.register(authRoute);
app.register(healthRoute, { prefix: "/api" });
app.register(billsRoute, { prefix: "/api" });

app.addHook("onClose", async () => {
  await authClient.close();
  await disconnectFromDatabase();
});

const start = async () => {
  try {
    await connectToDatabase();
    await app.listen({ port: 3000, host: "0.0.0.0" });
    app.log.info("Backend running at http://localhost:3000");
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
