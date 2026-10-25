import app from "./app.js";
import connectToDatabase, { disconnectFromDatabase } from "./config/db.js";
import { PORT } from "./config/env.js";

const port = Number(PORT) || 5000;

const startServer = async () => {
  await connectToDatabase();

  const server = app.listen(port, () => {
    console.log(`The Book Heaven API listening on http://localhost:${port}`);
    console.log(`API docs available at http://localhost:${port}/api/docs`);
  });

  const shutdown = (signal) => {
    console.log(`${signal} received. Closing the HTTP server...`);

    server.close(async () => {
      await disconnectFromDatabase();
      console.log("Shutdown complete");
      process.exit(0);
    });

    setTimeout(() => {
      console.error("Graceful shutdown timed out. Forcing exit.");
      process.exit(1);
    }, 10000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
};

startServer().catch((error) => {
  console.error("Unable to start the API:", error);
  process.exit(1);
});
