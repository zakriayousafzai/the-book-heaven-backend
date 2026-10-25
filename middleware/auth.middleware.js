import { getAuth, clerkClient } from "@clerk/express";
import { ApiError } from "../utils/apiError.js";

// Resolve the authenticated user's id, display name, and role. Session claims
// are used when available; Clerk's API is only called when the token does not
// carry the information (for example, a default session token without a
// custom `username` or `metadata.role` claim).
export const getClerkIdentity = async (req) => {
  const { userId, sessionClaims } = getAuth(req);

  if (!userId) {
    throw new ApiError(401, "Unauthorized");
  }

  const claims = sessionClaims ?? {};
  let userName = claims.username ?? claims.metadata?.userName;
  let role = claims.metadata?.role;

  if (!userName || !role) {
    const user = await clerkClient.users.getUser(userId);
    userName =
      userName ??
      user.username ??
      user.primaryEmailAddress?.emailAddress ??
      userId;
    role = role ?? user.publicMetadata?.role;
  }

  return { userId, role, userName: userName ?? userId };
};

export const getRole = async (req) => {
  const { userId, sessionClaims } = getAuth(req);

  if (!userId) {
    return null;
  }

  const claimRole = sessionClaims?.metadata?.role;
  if (claimRole) {
    return claimRole;
  }

  const user = await clerkClient.users.getUser(userId);
  return user.publicMetadata?.role ?? null;
};

export const isAdmin = async (req) => (await getRole(req)) === "admin";

export const requireAdmin = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);

    if (!userId) {
      throw new ApiError(401, "Unauthorized");
    }

    if ((await getRole(req)) !== "admin") {
      throw new ApiError(403, "Admin access required");
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireAuth = (req, res, next) => {
  const { isAuthenticated, userId } = getAuth(req);

  if (!isAuthenticated || !userId) {
    next(new ApiError(401, "Unauthorized"));
    return;
  }

  next();
};
