// Clerk's `getAuth` verifies that `req.auth` was installed by its middleware
// using a global brand symbol. Test requests bypass Clerk entirely, so the fake
// auth handler must carry the same brand.
const clerkAuthBrand = Symbol.for("@clerk/express.auth");

export const testAuthMiddleware = (req, res, next) => {
  const userId = req.get("x-test-user-id") || null;
  const userName = req.get("x-test-username") || null;
  const role = req.get("x-test-role") || "user";
  const isAuthenticated = Boolean(userId);

  const authHandler = () => ({
    tokenType: "session_token",
    userId,
    sessionId: isAuthenticated ? "sess_test" : null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    orgPermissions: null,
    sessionClaims: isAuthenticated
      ? { metadata: { role }, username: userName }
      : null,
    isAuthenticated,
    has: () => false,
    getToken: async () => null,
    debug: () => ({}),
  });

  authHandler[clerkAuthBrand] = true;
  req.auth = authHandler;

  next();
};
