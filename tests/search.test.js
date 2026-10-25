import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import {
  clearTestDatabase,
  startTestDatabase,
  stopTestDatabase,
} from "./helpers/db.js";
import { createBook } from "./helpers/factories.js";
import { api } from "./helpers/testApp.js";

before(startTestDatabase);
after(stopTestDatabase);
beforeEach(clearTestDatabase);

test("GET /api/books/search finds approved books case-insensitively", async () => {
  await createBook({
    title: "C++ Primer",
    author: "Stanley Lippman",
    genre: "Programming",
    description: "A thorough introduction to modern C++.",
    status: "allowed",
  });
  await createBook({
    title: "C++ Secrets",
    status: "pending",
  });

  const response = await api()
    .get("/api/books/search?q=c%2B%2B")
    .expect(200);

  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].title, "C++ Primer");
});

test("GET /api/books/search matches author, genre, and description", async () => {
  await createBook({
    title: "Unique Title",
    author: "Distinctive Author",
    genre: "Obscure Genre",
    description: "A one-of-a-kind description.",
  });

  for (const query of ["distinctive", "obscure", "one-of-a-kind"]) {
    const response = await api()
      .get(`/api/books/search?q=${encodeURIComponent(query)}`)
      .expect(200);

    assert.equal(response.body.data.length, 1, `expected a match for ${query}`);
  }
});

test("GET /api/books/search treats regex syntax as literal text", async () => {
  await createBook({ title: "Brackets [and] braces {too}" });
  await createBook({ title: "Unrelated" });

  const response = await api()
    .get("/api/books/search?q=%5Band%5D")
    .expect(200);

  assert.equal(response.body.data.length, 1);
  assert.equal(response.body.data[0].title, "Brackets [and] braces {too}");
});

test("GET /api/books/search requires a query and caps its length", async () => {
  const missing = await api().get("/api/books/search").expect(400);
  assert.equal(missing.body.error, "Search query is required");

  const blank = await api().get("/api/books/search?q=%20%20").expect(400);
  assert.equal(blank.body.error, "Search query is required");

  const tooLong = await api()
    .get(`/api/books/search?q=${"a".repeat(201)}`)
    .expect(400);
  assert.match(tooLong.body.error, /200 characters/);
});

test("GET /api/books/search paginates matching books", async () => {
  await Promise.all(
    Array.from({ length: 6 }, (_, index) =>
      createBook({ title: `Searchable ${index}` }),
    ),
  );

  const response = await api()
    .get("/api/books/search?q=searchable&page=2&limit=2")
    .expect(200);

  assert.equal(response.body.data.length, 2);
  assert.equal(response.body.pagination.currentPage, 2);
  assert.equal(response.body.pagination.totalPages, 3);
  assert.equal(response.body.pagination.totalItems, 6);
});
