import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import Book from "../models/book.model.js";
import Profile from "../models/profile.model.js";
import Review from "../models/review.model.js";
import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "./helpers/db.js";
import {
  createBook,
  createProfile,
  createReview,
  objectId,
} from "./helpers/factories.js";
import { api, withUser } from "./helpers/testApp.js";

before(startTestDatabase);
after(stopTestDatabase);
beforeEach(clearTestDatabase);

const bookPayload = {
  title: "The Pragmatic Programmer",
  author: "Andrew Hunt, David Thomas",
  genre: "Software Engineering",
  description: "A practical guide to the habits behind good software.",
};

test("GET /api/books returns only approved books", async () => {
  await createBook({ title: "Approved", status: "allowed" });
  await createBook({ title: "Pending", status: "pending" });
  await createBook({ title: "Denied", status: "denied" });

  const response = await api().get("/api/books").expect(200);

  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].title, "Approved");
  assert.deepEqual(response.body.pagination, {
    currentPage: 1,
    totalPages: 1,
    totalItems: 1,
    limit: 10,
  });
});

test("GET /api/books paginates results", async () => {
  await createBook({
    title: "Batch",
    status: "allowed",
  });
  await Book.insertMany(
    Array.from({ length: 11 }, (_, index) => ({
      userId: "user_owner",
      userName: "owner",
      title: `Book ${index}`,
      author: "Author",
      genre: "Fiction",
      description: "Description",
      status: "allowed",
    })),
  );

  const response = await api()
    .get("/api/books?page=2&limit=5")
    .expect(200);

  assert.equal(response.body.data.length, 5);
  assert.equal(response.body.pagination.currentPage, 2);
  assert.equal(response.body.pagination.totalPages, 3);
  assert.equal(response.body.pagination.totalItems, 12);
  assert.equal(response.body.pagination.limit, 5);
});

test("GET /api/books/:id hides unpublished books from the public", async () => {
  const pending = await createBook({
    title: "Work in progress",
    status: "pending",
  });

  await api().get(`/api/books/${pending._id}`).expect(404);

  const ownerResponse = await withUser(
    api().get(`/api/books/${pending._id}`),
    { userId: "user_owner", userName: "owner" },
  ).expect(200);

  assert.equal(ownerResponse.body.title, "Work in progress");

  await withUser(api().get(`/api/books/${pending._id}`), {
    userId: "user_admin",
    userName: "admin",
    role: "admin",
  }).expect(200);
});

test("GET /api/books/:id rejects malformed ids", async () => {
  const response = await api().get("/api/books/not-an-id").expect(400);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error, "Invalid book id");
});

test("POST /api/books requires authentication", async () => {
  const response = await api()
    .post("/api/books")
    .send(bookPayload)
    .expect(401);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error, "Unauthorized");
});

test("POST /api/books creates a pending recommendation and profile link", async () => {
  const response = await withUser(api().post("/api/books"), {
    userId: "user_reader",
    userName: "reader",
  })
    .send(bookPayload)
    .expect(201);

  assert.equal(response.body.status, "pending");
  assert.equal(response.body.userId, "user_reader");
  assert.equal(response.body.userName, "reader");

  const profile = await Profile.findOne({ userId: "user_reader" });
  assert.ok(profile);
  assert.equal(profile.username, "reader");
  assert.equal(profile.recommendedBooks.length, 1);
  assert.equal(
    profile.recommendedBooks[0].toString(),
    response.body._id.toString(),
  );
});

test("POST /api/books publishes admin recommendations immediately", async () => {
  const response = await withUser(api().post("/api/books"), {
    userId: "user_admin",
    userName: "admin",
    role: "admin",
  })
    .send(bookPayload)
    .expect(201);

  assert.equal(response.body.status, "allowed");
});

test("POST /api/books validates required fields", async () => {
  const response = await withUser(api().post("/api/books"), {
    userId: "user_reader",
    userName: "reader",
  })
    .send({ title: "Only a title" })
    .expect(400);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error, "Validation failed");
  assert.ok(Array.isArray(response.body.details));
  assert.ok(response.body.details.length >= 1);
});

test("PUT /api/books/:id lets the owner edit content but not moderation fields", async () => {
  const book = await createBook({
    title: "Original",
    status: "pending",
    userId: "user_owner",
    userName: "owner",
  });

  const response = await withUser(api().put(`/api/books/${book._id}`), {
    userId: "user_owner",
    userName: "owner",
  })
    .send({
      title: "Edited",
      status: "allowed",
      userId: "user_attacker",
    })
    .expect(200);

  assert.equal(response.body.title, "Edited");
  assert.equal(response.body.status, "pending");
  assert.equal(response.body.userId, "user_owner");
});

test("PUT /api/books/:id rejects other users and allows admins", async () => {
  const book = await createBook({ status: "pending" });

  await withUser(api().put(`/api/books/${book._id}`), {
    userId: "user_other",
    userName: "other",
  })
    .send({ title: "Hijacked" })
    .expect(403);

  const adminResponse = await withUser(
    api().put(`/api/books/${book._id}`),
    {
      userId: "user_admin",
      userName: "admin",
      role: "admin",
    },
  )
    .send({ title: "Admin edit" })
    .expect(200);

  assert.equal(adminResponse.body.title, "Admin edit");
});

test("PUT /api/books/:id rejects a body with no editable fields", async () => {
  const book = await createBook();

  const response = await withUser(api().put(`/api/books/${book._id}`), {
    userId: "user_owner",
  })
    .send({ status: "allowed" })
    .expect(400);

  assert.match(response.body.error, /editable field/);
});

test("DELETE /api/books/:id cascades reviews and profile references", async () => {
  const book = await createBook({ userId: "user_owner" });
  await createReview(book._id);
  await createProfile({
    userId: "user_owner",
    username: "owner",
    recommendedBooks: [book._id],
  });
  await createProfile({
    userId: "user_fan",
    username: "fan",
    favoriteBooks: [book._id],
  });

  await withUser(api().delete(`/api/books/${book._id}`), {
    userId: "user_owner",
  }).expect(200);

  assert.equal(await Book.findById(book._id), null);
  assert.equal(await Review.countDocuments({ bookId: book._id }), 0);

  const ownerProfile = await Profile.findOne({ userId: "user_owner" });
  const fanProfile = await Profile.findOne({ userId: "user_fan" });
  assert.equal(ownerProfile.recommendedBooks.length, 0);
  assert.equal(fanProfile.favoriteBooks.length, 0);
});

test("DELETE /api/books/:id rejects other users and allows admins", async () => {
  const book = await createBook({ userId: "user_owner" });

  await withUser(api().delete(`/api/books/${book._id}`), {
    userId: "user_other",
    userName: "other",
  }).expect(403);

  await withUser(api().delete(`/api/books/${book._id}`), {
    userId: "user_admin",
    userName: "admin",
    role: "admin",
  }).expect(200);

  assert.equal(await Book.findById(book._id), null);
});

test("book endpoints reject malformed ids consistently", async () => {
  const response = await withUser(
    api().put(`/api/books/${objectId()}x`),
    { userId: "user_owner" },
  )
    .send({ title: "Nope" })
    .expect(400);

  assert.equal(response.body.error, "Invalid book id");
});
