import cors from "@fastify/cors";
import Fastify from "fastify";
import { authClient } from "./auth.js";
import { env } from "./config.js";
import { connectToDatabase, disconnectFromDatabase } from "./database.js";
import { authRoute } from "./routes/auth.js";
import { billsRoute } from "./routes/bills.js";
import { healthRoute } from "./routes/health.js";

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.CLIENT_ORIGIN,
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
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`Backend running at http://${env.HOST}:${env.PORT}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
