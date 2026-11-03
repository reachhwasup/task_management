import "dotenv/config";

import { createServer } from "http";
import { createApp } from "./app";
import { initSockets } from "./sockets";

const PORT = Number(process.env.PORT) || 4000;

for (const key of ["DATABASE_URL", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const) {
  const value = process.env[key];
  if (!value) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
  if (process.env.NODE_ENV === "production" && value.includes("change-me")) {
    console.error(`${key} still has its placeholder value — set a real secret before deploying`);
    process.exit(1);
  }
}

const app = createApp();
const httpServer = createServer(app);
initSockets(httpServer);

httpServer.listen(PORT, () => {
  console.log(`🚀 API + WebSocket server listening on http://localhost:${PORT}`);
});
