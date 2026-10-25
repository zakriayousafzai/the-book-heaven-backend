import { isProduction } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

const normalizeError = (error) => {
  if (error instanceof ApiError) {
    return {
      statusCode: error.statusCode,
      message: error.message,
      details: error.details,
    };
  }

  if (error.name === "CastError") {
    return {
      statusCode: 400,
      message: `Invalid ${error.path ?? "resource"} id`,
    };
  }

  if (error.code === 11000) {
    return {
      statusCode: 409,
      message: "A record with this value already exists",
      details: error.keyValue,
    };
  }

  if (error.name === "ValidationError") {
    return {
      statusCode: 400,
      message: "Validation failed",
      details: Object.values(error.errors).map((item) => item.message),
    };
  }

  if (error.type === "entity.parse.failed") {
    return { statusCode: 400, message: "Invalid JSON body" };
  }

  if (error.type === "entity.too.large") {
    return { statusCode: 413, message: "Request body is too large" };
  }

  return {
    statusCode: error.statusCode || 500,
    message: error.message || "Internal server error",
  };
};

// Normalize every failure into one predictable response envelope:
// { success: false, error: "message", details?: [...] }
const errorMiddleware = (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  const normalized = normalizeError(error);
  const statusCode = normalized.statusCode;

  if (statusCode >= 500) {
    console.error(error);
  }

  const body = {
    success: false,
    error:
      statusCode >= 500 && isProduction
        ? "Internal server error"
        : normalized.message,
  };

  if (
    normalized.details !== undefined &&
    !(statusCode >= 500 && isProduction)
  ) {
    body.details = normalized.details;
  }

  res.status(statusCode).json(body);
};

export default errorMiddleware;
