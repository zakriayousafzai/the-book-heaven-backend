# Deployment Guide

This document walks through deploying the API to a managed Node host with
MongoDB Atlas and Clerk. The repository includes a `render.yaml` blueprint and
a production `Dockerfile`; the same steps apply to Railway, Fly.io, or any
container host.

> No live deployment is bundled with this repository. The instructions below
> are the intended production path and should be verified in your own accounts.

## 1. Production checklist

| Requirement | Where it comes from |
| --- | --- |
| Node.js 22+ runtime | Host / Docker image |
| MongoDB connection string | MongoDB Atlas |
| Clerk publishable + secret keys | Clerk Dashboard |
| Admin user | Clerk public metadata: `{ "role": "admin" }` |
| Frontend origin(s) | `CORS_ORIGIN`, comma-separated |
| Health check path | `/health` |
| API docs | `/api/docs` |

Never commit `.env` or paste secrets into the repository. `.env.example` is the
only env file tracked by Git.

## 2. MongoDB Atlas

1. Create a free Atlas cluster and a database user with read/write access.
2. Add a network access rule. Managed hosts without static egress IPs (Render,
   Railway, Fly.io) generally require `0.0.0.0/0`; pair this with a strong
   database password and TLS.
3. Copy the driver connection string and add a database name:

   ```text
   mongodb+srv://<user>:<password>@<cluster>.mongodb.net/the-book-heaven?retryWrites=true&w=majority
   ```

4. Store it as `DB_URI` in the hosting provider's secret settings.

The API connects before it starts accepting traffic. If MongoDB is unreachable,
the process exits instead of serving a half-broken API.

## 3. Clerk

1. Create a Clerk application (or promote an existing development instance to
   production).
2. Copy `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` into the host's env.
3. Give moderators the admin role. In the Clerk Dashboard, open the user and add
   this to **Public metadata**:

   ```json
   { "role": "admin" }
   ```

   The API checks session claims first and falls back to the user's public
   metadata. Every admin endpoint requires this role.
4. If you want to avoid the per-request Clerk user lookup, add `role` and
   `username` as custom session claims in Clerk. The API already reads both
   when present.

## 4. Deploy on Render (blueprint)

The included [`render.yaml`](../render.yaml) defines a Node web service with a
health check.

1. Push the repository to GitHub.
2. In Render, choose **New > Blueprint** and connect the repository.
3. Fill in the secret env vars when prompted:
   - `DB_URI`
   - `CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
   - `CORS_ORIGIN` (for example `https://the-book-heaven.vercel.app`)
4. Deploy. Render runs `npm ci --omit=dev --ignore-scripts` and `npm start`.
5. Confirm `https://<service>.onrender.com/health` returns `200`.

Free Render services sleep after inactivity. The first request after a sleep can
take several seconds; use a paid instance or an uptime monitor if that matters.

## 5. Deploy with Docker

Build and run the production image directly:

```bash
docker build -t the-book-heaven-api .
docker run --rm -p 5000:5000 --env-file .env.production the-book-heaven-api
```

The image:

- uses `node:22-alpine`
- installs production dependencies only
- runs as the unprivileged `node` user
- exposes port `5000`
- has a built-in `HEALTHCHECK` against `/health`

For local API + MongoDB, use the included Compose file:

```bash
# .env must contain CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY
docker compose up --build
```

Compose starts MongoDB 7 with a persistent volume and the API on
`http://localhost:5000`. The Compose file uses a local MongoDB; point `DB_URI` at
Atlas if you want to use the hosted database instead.

## 6. Deploy on Railway or Fly.io

Both platforms work with the Node runtime or the Dockerfile.

**Railway**

1. Create a project from the GitHub repository.
2. Add `DB_URI`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CORS_ORIGIN`, and
   `NODE_ENV=production`.
3. Set the health check path to `/health`.
4. Railway detects `npm start` from `package.json`.

**Fly.io**

```bash
fly launch --no-deploy
fly secrets set DB_URI="..." CLERK_PUBLISHABLE_KEY="..." CLERK_SECRET_KEY="..." CORS_ORIGIN="..."
fly deploy
```

Add a health check in `fly.toml`:

```toml
[[http_service.checks]]
  path = "/health"
  interval = "30s"
  timeout = "5s"
```

## 7. Connect the frontend

In the frontend host (for example Vercel), set:

```text
NEXT_PUBLIC_API_URL=https://<api-host>
```

Then set the API's `CORS_ORIGIN` to the frontend origin. Multiple origins are
comma-separated:

```text
CORS_ORIGIN=https://the-book-heaven.vercel.app,http://localhost:3000
```

The API uses bearer tokens, not cookies, but a narrow CORS allowlist is still the
recommended production setting.

## 8. Post-deploy smoke test

```bash
# 1. Liveness
curl -fsS https://<api-host>/health

# 2. Public catalog
curl -fsS "https://<api-host>/api/books?page=1&limit=5"

# 3. Interactive docs: open https://<api-host>/api/docs in a browser

# 4. Authenticated write (use a real Clerk session token)
curl -fsS -X POST "https://<api-host>/api/books" \
  -H "Authorization: Bearer $CLERK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Deployment Test","author":"Ops","genre":"Testing","description":"Created during deployment verification."}'
```

The write should return `201` and `"status": "pending"` for a non-admin user.
Approve it with an admin token to verify the moderation path end to end.

## 9. Operations notes

- **Logs:** the API logs startup, shutdown, and server-side errors. Request
  logging/APM is not included; add the host's log drain or an OpenTelemetry
  integration for production observability.
- **Graceful shutdown:** `server.js` handles `SIGINT`/`SIGTERM`, stops accepting
  connections, disconnects from MongoDB, and forces exit after 10 seconds.
- **Migrations:** there is no migration framework. Schema changes are additive
  and handled by Mongoose; take an Atlas backup before destructive changes.
- **Backups:** enable Atlas automated backups before opening the app to users.
- **Scaling:** the API is stateless, so multiple instances are safe. MongoDB
  connection pooling is handled by Mongoose.
- **Rate limiting:** not implemented. Add a gateway rule or
  `express-rate-limit` before exposing write endpoints to the open internet.
- **API docs:** Swagger UI is public at `/api/docs`. Disable or protect it at the
  edge if you do not want to publish the schema.

## 10. Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Process exits on boot | `DB_URI` missing or Atlas unreachable | Check the env var, Atlas network access, and database user |
| `401 Unauthorized` | Missing/expired Clerk token | Send `Authorization: Bearer <session token>` |
| `403 Admin access required` | User lacks the admin role | Add `{ "role": "admin" }` to Clerk public metadata |
| Browser CORS error | Frontend origin not allowed | Add it to `CORS_ORIGIN` (comma-separated) and redeploy |
| Health check fails | Port mismatch | The host must route to `PORT` (default `5000`) |
| Cold-start timeouts | Free tier sleeping | Use a paid instance or warm the service |
