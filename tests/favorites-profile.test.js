import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import Profile from "../models/profile.model.js";
import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "./helpers/db.js";
import {
  createBook,
  createProfile,
  objectId,
} from "./helpers/factories.js";
import { api, withUser } from "./helpers/testApp.js";

before(startTestDatabase);
after(stopTestDatabase);
beforeEach(clearTestDatabase);

test("GET /api/users/:username shows only approved recommendations publicly", async () => {
  const approved = await createBook({
    title: "Approved",
    userId: "user_owner",
    userName: "owner",
    status: "allowed",
  });
  const pending = await createBook({
    title: "Pending",
    userId: "user_owner",
    userName: "owner",
    status: "pending",
  });
  const favorite = await createBook({
    title: "Favorite",
    userId: "user_other",
    userName: "other",
    status: "allowed",
  });

  await createProfile({
    userId: "user_owner",
    username: "owner",
    recommendedBooks: [approved._id, pending._id],
    favoriteBooks: [favorite._id],
  });

  const response = await api().get("/api/users/owner").expect(200);

  assert.deepEqual(
    response.body.recommendedBooks.map((book) => book.title),
    ["Approved"],
  );
  assert.equal(response.body.favoriteBooks, undefined);
});

test("GET /api/users/:username shows the owner their pending books and favorites", async () => {
  const approved = await createBook({
    title: "Approved",
    userId: "user_owner",
    userName: "owner",
    status: "allowed",
  });
  const pending = await createBook({
    title: "Pending",
    userId: "user_owner",
    userName: "owner",
    status: "pending",
  });
  const favorite = await createBook({
    title: "Favorite",
    userId: "user_other",
    userName: "other",
    status: "allowed",
  });

  await createProfile({
    userId: "user_owner",
    username: "owner",
    recommendedBooks: [approved._id, pending._id],
    favoriteBooks: [favorite._id],
  });

  const response = await withUser(api().get("/api/users/owner"), {
    userId: "user_owner",
    userName: "owner",
  }).expect(200);

  assert.equal(response.body.recommendedBooks.length, 2);
  assert.equal(response.body.favoriteBooks.length, 1);
  assert.equal(response.body.favoriteBooks[0].title, "Favorite");
});

test("GET /api/users/:username returns an empty profile for a new owner", async () => {
  const response = await withUser(api().get("/api/users/newreader"), {
    userId: "user_new",
    userName: "newreader",
  }).expect(200);

  assert.deepEqual(response.body, {
    username: "newreader",
    recommendedBooks: [],
    favoriteBooks: [],
  });
});

test("GET /api/users/:username returns 404 for an unknown profile", async () => {
  const response = await api().get("/api/users/nobody").expect(404);

  assert.equal(response.body.error, "Profile not found");
});

test("favorites require authentication", async () => {
  await api().get("/api/favorite").expect(401);
  await api()
    .post("/api/favorite")
    .send({ bookId: objectId() })
    .expect(401);
});

test("POST /api/favorite adds an approved book idempotently", async () => {
  const book = await createBook({ title: "Favorite me" });

  const first = await withUser(api().post("/api/favorite"), {
    userId: "user_reader",
    userName: "reader",
  })
    .send({ bookId: book._id.toString() })
    .expect(201);

  assert.equal(first.body.length, 1);
  assert.equal(first.body[0].title, "Favorite me");

  const second = await withUser(api().post("/api/favorite"), {
    userId: "user_reader",
    userName: "reader",
  })
    .send({ bookId: book._id.toString() })
    .expect(201);

  assert.equal(second.body.length, 1);

  const profile = await Profile.findOne({ userId: "user_reader" });
  assert.equal(profile.favoriteBooks.length, 1);
});

test("POST /api/favorite rejects unpublished books and invalid ids", async () => {
  const pending = await createBook({ status: "pending" });

  await withUser(api().post("/api/favorite"), {
    userId: "user_reader",
    userName: "reader",
  })
    .send({ bookId: pending._id.toString() })
    .expect(404);

  const response = await withUser(api().post("/api/favorite"), {
    userId: "user_reader",
    userName: "reader",
  })
    .send({ bookId: "nope" })
    .expect(400);

  assert.equal(response.body.error, "Invalid book id");
});

test("GET and DELETE /api/favorite manage the signed-in user's list", async () => {
  const book = await createBook({ title: "Saved book" });
  await createProfile({
    userId: "user_reader",
    username: "reader",
    favoriteBooks: [book._id],
  });

  const list = await withUser(api().get("/api/favorite"), {
    userId: "user_reader",
    userName: "reader",
  }).expect(200);

  assert.equal(list.body.length, 1);
  assert.equal(list.body[0].title, "Saved book");

  const removed = await withUser(
    api().delete(`/api/favorite/${book._id}`),
    { userId: "user_reader", userName: "reader" },
  ).expect(200);

  assert.equal(removed.body.message, "Favorite deleted successfully");
  assert.equal(removed.body.favoriteBooks.length, 0);
});

test("DELETE /api/favorite/:bookId validates ids and missing profiles", async () => {
  const invalid = await withUser(
    api().delete("/api/favorite/not-an-id"),
    { userId: "user_reader", userName: "reader" },
  ).expect(400);

  assert.equal(invalid.body.error, "Invalid book id");

  const missing = await withUser(
    api().delete(`/api/favorite/${objectId()}`),
    { userId: "user_without_profile", userName: "nobody" },
  ).expect(404);

  assert.equal(missing.body.error, "Profile not found");
});
