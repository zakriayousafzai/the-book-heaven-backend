# Postman collection

Import [`the-book-heaven.postman_collection.json`](./the-book-heaven.postman_collection.json)
into Postman.

## Setup

1. Set the collection variable `baseUrl` (default `http://localhost:5000`).
2. Set `clerkToken` to a Clerk session token. You can copy one from the frontend
   while signed in, or use Clerk's testing tools.
3. Set `username` to a profile you want to inspect.
4. For admin requests, the token's user must have `role: "admin"` in Clerk public
   metadata or session claims.

## Suggested run order

1. **Health → Health check**
2. **Books → List approved books**
3. **Books → Create book** (stores the new `bookId`)
4. **Books → Get book by id**
5. **Reviews → Create review** (stores the new `reviewId`)
6. **Reviews → Update review**
7. **Favorites → Add favorite**
8. **Profiles → Get profile**
9. **Admin → List books by status**
10. **Admin → Approve book**

The create-book and create-review requests include test scripts that populate
the `bookId` and `reviewId` collection variables automatically.
