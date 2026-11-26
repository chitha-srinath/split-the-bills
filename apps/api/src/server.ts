import Fastify from "fastify";
import cors from "@fastify/cors";
import { healthRoute } from "./routes/health.js";
import { billsRoute } from "./routes/bills.js";

const app = Fastify({
  logger: true,
});

// Register plugins
await app.register(cors, {
  origin: true,
});

// Register routes
app.register(healthRoute, { prefix: "/api" });
app.register(billsRoute, { prefix: "/api" });

// Start server
const start = async () => {
  try {
    await app.listen({ port: 3000, host: "0.0.0.0" });
    console.log("🚀 Backend running at http://localhost:3000");
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
