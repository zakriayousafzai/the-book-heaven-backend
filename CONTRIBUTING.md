# Contributing

Thanks for taking a look at The Book Heaven API.

## Local setup

1. Use Node.js 22+ (`nvm use` picks up `.nvmrc`).
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env` and fill in `DB_URI` and the Clerk keys.
4. Start MongoDB locally (or use Atlas) and run `npm run dev`.

The test suite does not need real credentials:

```bash
npm test
```

## Before opening a pull request

- Keep the API contract and the OpenAPI document in sync
  (`docs/openapi.yaml`).
- Run `npm test` and `npm run docs:check`.
- Add or update tests for behavior changes, especially authorization and
  moderation paths.
- Do not commit `.env` files, Clerk secrets, or database credentials.
- Keep success response shapes stable; the Next.js client depends on them.
- Use clear, imperative commit messages (for example,
  `Add review ownership checks`).

## Security-sensitive changes

Review [`SECURITY.md`](SECURITY.md) for the reporting process. Do not open a
public issue for a suspected vulnerability.
