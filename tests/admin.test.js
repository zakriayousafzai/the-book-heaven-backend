import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import Book from "../models/book.model.js";
import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "./helpers/db.js";
import { createBook, objectId } from "./helpers/factories.js";
import { api, withUser } from "./helpers/testApp.js";

before(startTestDatabase);
after(stopTestDatabase);
beforeEach(clearTestDatabase);

test("admin moderation endpoints require authentication and an admin role", async () => {
  await api().get("/api/admin/books").expect(401);

  await withUser(api().get("/api/admin/books"), {
    userId: "user_reader",
    userName: "reader",
    role: "user",
  }).expect(403);
});

test("GET /api/admin/books defaults to pending and filters by status", async () => {
  await createBook({ title: "Pending one", status: "pending" });
  await createBook({ title: "Allowed one", status: "allowed" });
  await createBook({ title: "Denied one", status: "denied" });

  const pending = await withUser(api().get("/api/admin/books"), {
    userId: "user_admin",
    userName: "admin",
    role: "admin",
  }).expect(200);

  assert.equal(pending.body.data.length, 1);
  assert.equal(pending.body.data[0].title, "Pending one");

  const denied = await withUser(
    api().get("/api/admin/books?status=denied"),
    {
      userId: "user_admin",
      userName: "admin",
      role: "admin",
    },
  ).expect(200);

  assert.equal(denied.body.data.length, 1);
  assert.equal(denied.body.data[0].title, "Denied one");
});

test("GET /api/admin/books rejects an invalid status", async () => {
  const response = await withUser(
    api().get("/api/admin/books?status=unknown"),
    {
      userId: "user_admin",
      userName: "admin",
      role: "admin",
    },
  ).expect(400);

  assert.match(response.body.error, /status must be one of/);
});

test("POST /api/admin/books/:bookId/approve publishes a book", async () => {
  const book = await createBook({ status: "pending" });

  const response = await withUser(
    api().post(`/api/admin/books/${book._id}/approve`),
    {
      userId: "user_admin",
      userName: "admin",
      role: "admin",
    },
  ).expect(200);

  assert.equal(response.body.message, "Book approved successfully");
  assert.equal(response.body.book.status, "allowed");

  const stored = await Book.findById(book._id);
  assert.equal(stored.status, "allowed");
});

test("POST /api/admin/books/:bookId/deny hides a book", async () => {
  const book = await createBook({ status: "pending" });

  const response = await withUser(
    api().post(`/api/admin/books/${book._id}/deny`),
    {
      userId: "user_admin",
      userName: "admin",
      role: "admin",
    },
  ).expect(200);

  assert.equal(response.body.book.status, "denied");
});

test("moderation endpoints validate ids and missing books", async () => {
  const invalid = await withUser(
    api().post("/api/admin/books/not-an-id/approve"),
    {
      userId: "user_admin",
      userName: "admin",
      role: "admin",
    },
  ).expect(400);

  assert.equal(invalid.body.error, "Invalid book id");

  const missing = await withUser(
    api().post(`/api/admin/books/${objectId()}/approve`),
    {
      userId: "user_admin",
      userName: "admin",
      role: "admin",
    },
  ).expect(404);

  assert.equal(missing.body.error, "Book not found");
});

test("a regular user cannot approve books", async () => {
  const book = await createBook({ status: "pending" });

  await withUser(
    api().post(`/api/admin/books/${book._id}/approve`),
    {
      userId: "user_reader",
      userName: "reader",
      role: "user",
    },
  ).expect(403);

  const stored = await Book.findById(book._id);
  assert.equal(stored.status, "pending");
});
