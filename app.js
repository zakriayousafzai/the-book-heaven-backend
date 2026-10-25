import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { clerkMiddleware } from "@clerk/express";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";

import bookRouter from "./routes/book.router.js";
import reviewRouter from "./routes/review.router.js";
import favoriteRouter from "./routes/favorites.router.js";
import profileRouter from "./routes/profile.router.js";
import searchRouter from "./routes/search.router.js";
import adminRouter from "./routes/admin.router.js";
import errorMiddleware from "./middleware/error.middleware.js";
import notFoundMiddleware from "./middleware/notFound.middleware.js";
import { corsOrigins } from "./config/env.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const openapiDocument = YAML.parse(
  fs.readFileSync(path.join(currentDirectory, "docs", "openapi.yaml"), "utf8"),
);

const databaseState = () =>
  ["disconnected", "connected", "connecting", "disconnecting"][
    mongoose.connection.readyState
  ] ?? "unknown";

const corsOptions = corsOrigins.length
  ? {
      origin: corsOrigins,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 86400,
    }
  : undefined;

export const createApp = ({ withClerk = true, authMiddleware } = {}) => {
  const app = express();

  app.disable("x-powered-by");
  // CSP is disabled because Swagger UI serves inline bootstrap scripts. The
  // remaining Helmet headers (nosniff, frame denial, HSTS, etc.) still apply.
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));

  // Operational and documentation endpoints stay outside Clerk's auth
  // middleware so health checks and API docs work without a session.
  app.get("/health", (req, res) => {
    res.status(200).json({
      success: true,
      status: "ok",
      database: databaseState(),
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get("/", (req, res) => {
    res.status(200).json({
      name: "The Book Heaven API",
      version: "1.0.0",
      docs: "/api/docs",
      health: "/health",
    });
  });

  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument, {
    customSiteTitle: "The Book Heaven API",
    swaggerOptions: { persistAuthorization: true },
  }));
  app.get("/api/docs.json", (req, res) => res.json(openapiDocument));

  if (withClerk) {
    app.use(clerkMiddleware());
  }

  // Tests inject a deterministic auth middleware here; production always uses
  // Clerk above.
  if (authMiddleware) {
    app.use(authMiddleware);
  }

  app.use("/api", searchRouter);
  app.use("/api", bookRouter);
  app.use("/api", reviewRouter);
  app.use("/api", favoriteRouter);
  app.use("/api/users", profileRouter);
  app.use("/api", adminRouter);

  app.use(notFoundMiddleware);
  app.use(errorMiddleware);

  return app;
};

const app = createApp();

export default app;
