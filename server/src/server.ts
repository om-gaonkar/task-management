import { createApp } from "./app.js";
import { connectDatabase } from "./config/database.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";

async function main() {
  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, "API listening"));
  const shutdown = (signal: string) => {
    logger.info({ signal }, "Shutting down");
    server.close(() => process.exit(0));
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((error) => {
  logger.fatal({ err: error }, "Failed to start API");
  process.exit(1);
});
