import { test } from "node:test";
import assert from "node:assert/strict";
import { api } from "./helpers/testApp.js";

test("GET /health reports API liveness", async () => {
  const response = await api().get("/health").expect(200);

  assert.equal(response.body.success, true);
  assert.equal(response.body.status, "ok");
  assert.equal(typeof response.body.uptime, "number");
  assert.match(response.body.timestamp, /^\d{4}-\d{2}-\d{2}T/);
});

test("responses include baseline security headers", async () => {
  const response = await api().get("/health").expect(200);

  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["x-frame-options"], "SAMEORIGIN");
});

test("GET / exposes API discovery metadata", async () => {
  const response = await api().get("/").expect(200);

  assert.equal(response.body.name, "The Book Heaven API");
  assert.equal(response.body.docs, "/api/docs");
  assert.equal(response.body.health, "/health");
});

test("GET /api/docs serves the Swagger UI", async () => {
  const response = await api().get("/api/docs/").expect(200);

  assert.match(response.headers["content-type"], /text\/html/);
});

test("GET /api/docs.json serves the OpenAPI document", async () => {
  const response = await api().get("/api/docs.json").expect(200);

  assert.equal(response.body.openapi, "3.0.3");
  assert.equal(response.body.info.title, "The Book Heaven API");
  assert.ok(response.body.paths["/api/books"]);
});

test("unknown routes return a consistent 404 envelope", async () => {
  const response = await api().get("/api/not-a-real-route").expect(404);

  assert.equal(response.body.success, false);
  assert.match(response.body.error, /Route not found/);
});

test("malformed JSON returns a 400 error envelope", async () => {
  const response = await api()
    .post("/api/books")
    .set("Content-Type", "application/json")
    .send('{"title":')
    .expect(400);

  assert.equal(response.body.success, false);
  assert.equal(response.body.error, "Invalid JSON body");
});
