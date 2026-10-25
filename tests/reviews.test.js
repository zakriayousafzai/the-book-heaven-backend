import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import Review from "../models/review.model.js";
import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "./helpers/db.js";
import {
  createBook,
  createReview,
  objectId,
} from "./helpers/factories.js";
import { api, withUser } from "./helpers/testApp.js";

before(startTestDatabase);
after(stopTestDatabase);
beforeEach(clearTestDatabase);

test("GET /api/books/:id/reviews paginates reviews for an approved book", async () => {
  const book = await createBook();
  await createReview(book._id, { comment: "First" });
  await createReview(book._id, { comment: "Second" });

  const response = await api()
    .get(`/api/books/${book._id}/reviews?page=1&limit=1`)
    .expect(200);

  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.pagination.totalItems, 2);
  assert.equal(response.body.pagination.totalPages, 2);
});

test("GET /api/books/:id/reviews hides reviews for unpublished books", async () => {
  const book = await createBook({ status: "pending" });

  await api().get(`/api/books/${book._id}/reviews`).expect(404);

  await withUser(api().get(`/api/books/${book._id}/reviews`), {
    userId: "user_owner",
  }).expect(200);
});

test("POST /api/books/:id/reviews requires authentication", async () => {
  const book = await createBook();

  const response = await api()
    .post(`/api/books/${book._id}/reviews`)
    .send({ rating: 5, comment: "Loved it" })
    .expect(401);

  assert.equal(response.body.error, "Unauthorized");
});

test("POST /api/books/:id/reviews creates a review for an approved book", async () => {
  const book = await createBook();

  const response = await withUser(
    api().post(`/api/books/${book._id}/reviews`),
    { userId: "user_reader", userName: "reader" },
  )
    .send({ rating: 4, comment: "Very useful." })
    .expect(201);

  assert.equal(response.body.message, "Review added successfully");
  assert.equal(response.body.newReview.rating, 4);
  assert.equal(response.body.newReview.reviewerName, "reader");

  const stored = await Review.findById(response.body.newReview._id);
  assert.ok(stored);
});

test("POST /api/books/:id/reviews rejects unpublished books", async () => {
  const book = await createBook({ status: "pending" });

  const response = await withUser(
    api().post(`/api/books/${book._id}/reviews`),
    { userId: "user_reader", userName: "reader" },
  )
    .send({ rating: 5, comment: "Sneaky" })
    .expect(403);

  assert.match(response.body.error, /not approved/);
});

test("POST /api/books/:id/reviews validates the rating range", async () => {
  const book = await createBook();

  const response = await withUser(
    api().post(`/api/books/${book._id}/reviews`),
    { userId: "user_reader", userName: "reader" },
  )
    .send({ rating: 6, comment: "Too high" })
    .expect(400);

  assert.equal(response.body.error, "Validation failed");
  assert.ok(response.body.details.some((detail) => /maximum/i.test(detail)));
});

test("POST /api/books/:id/reviews requires a whole-number rating", async () => {
  const book = await createBook();

  const response = await withUser(
    api().post(`/api/books/${book._id}/reviews`),
    { userId: "user_reader", userName: "reader" },
  )
    .send({ rating: 4.5, comment: "Half a star" })
    .expect(400);

  assert.equal(response.body.error, "Validation failed");
  assert.ok(response.body.details.some((detail) => /whole number/i.test(detail)));
});

test("PUT /api/reviews/:id lets the author edit only rating and comment", async () => {
  const book = await createBook();
  const otherBook = await createBook({ title: "Other book" });
  const review = await createReview(book._id, {
    userId: "user_owner",
    reviewerName: "owner",
  });

  const response = await withUser(
    api().put(`/api/reviews/${review._id}`),
    { userId: "user_owner" },
  )
    .send({
      rating: 3,
      comment: "Changed my mind.",
      bookId: otherBook._id.toString(),
      userId: "user_attacker",
    })
    .expect(200);

  assert.equal(response.body.updatedReview.rating, 3);
  assert.equal(response.body.updatedReview.comment, "Changed my mind.");
  assert.equal(
    response.body.updatedReview.bookId.toString(),
    book._id.toString(),
  );
  assert.equal(response.body.updatedReview.userId, "user_owner");
});

test("PUT /api/reviews/:id rejects other users and allows admins", async () => {
  const book = await createBook();
  const review = await createReview(book._id, { userId: "user_owner" });

  await withUser(api().put(`/api/reviews/${review._id}`), {
    userId: "user_other",
    userName: "other",
  })
    .send({ rating: 1 })
    .expect(403);

  await withUser(api().put(`/api/reviews/${review._id}`), {
    userId: "user_admin",
    userName: "admin",
    role: "admin",
  })
    .send({ rating: 2 })
    .expect(200);

  const updated = await Review.findById(review._id);
  assert.equal(updated.rating, 2);
});

test("PUT /api/reviews/:id rejects a body with no editable fields", async () => {
  const book = await createBook();
  const review = await createReview(book._id);

  const response = await withUser(
    api().put(`/api/reviews/${review._id}`),
    { userId: "user_owner" },
  )
    .send({ bookId: book._id.toString() })
    .expect(400);

  assert.match(response.body.error, /editable field/);
});

test("DELETE /api/reviews/:id enforces ownership", async () => {
  const book = await createBook();
  const review = await createReview(book._id, { userId: "user_owner" });

  await withUser(api().delete(`/api/reviews/${review._id}`), {
    userId: "user_other",
    userName: "other",
  }).expect(403);

  await withUser(api().delete(`/api/reviews/${review._id}`), {
    userId: "user_owner",
  }).expect(200);

  assert.equal(await Review.findById(review._id), null);
});

test("review endpoints reject malformed ids", async () => {
  const response = await withUser(
    api().delete(`/api/reviews/${objectId()}x`),
    { userId: "user_owner" },
  ).expect(400);

  assert.equal(response.body.error, "Invalid review id");
});
