import request from "supertest";
import { createApp } from "../../app.js";
import { testAuthMiddleware } from "./testAuth.js";

export const app = createApp({
  withClerk: false,
  authMiddleware: testAuthMiddleware,
});

export const api = () => request(app);

export const withUser = (
  req,
  {
    userId = "user_owner",
    userName = "owner",
    role = "user",
  } = {},
) =>
  req
    .set("x-test-user-id", userId)
    .set("x-test-username", userName)
    .set("x-test-role", role);
