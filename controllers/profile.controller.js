import { getAuth } from "@clerk/express";
import Profile from "../models/profile.model.js";
import Book from "../models/book.model.js";
import { getClerkIdentity } from "../middleware/auth.middleware.js";
import { ApiError } from "../utils/apiError.js";
import { assertObjectId } from "../utils/objectId.js";

// Public profile by username. Owners also see their favorites and books that
// are still pending or denied; everyone else only sees approved books.
export const getProfileByUsername = async (req, res, next) => {
  try {
    const { username } = req.params;
    if (!username?.trim()) {
      throw new ApiError(400, "Username is required");
    }

    const { isAuthenticated } = getAuth(req);
    const identity = isAuthenticated ? await getClerkIdentity(req) : null;

    const profile = await Profile.findOne({ username });
    const isOwner = profile
      ? Boolean(identity && profile.userId === identity.userId)
      : Boolean(identity && identity.userName === username);

    if (!profile) {
      if (isOwner) {
        return res.status(200).json({
          username,
          recommendedBooks: [],
          favoriteBooks: [],
        });
      }
      throw new ApiError(404, "Profile not found");
    }

    await profile.populate({
      path: "recommendedBooks",
      match: isOwner ? {} : { status: "allowed" },
    });

    if (isOwner) {
      await profile.populate({
        path: "favoriteBooks",
        match: { status: "allowed" },
      });
    }

    const recommendedBooks = (profile.recommendedBooks || []).filter(Boolean);

    if (isOwner) {
      return res.status(200).json({
        username: profile.username,
        recommendedBooks,
        favoriteBooks: (profile.favoriteBooks || []).filter(Boolean),
      });
    }

    return res.status(200).json({
      username: profile.username,
      recommendedBooks,
    });
  } catch (error) {
    next(error);
  }
};

// List the signed-in user's favorites (populated with book documents).
export const getFavorites = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const profile = await Profile.findOne({ userId }).populate("favoriteBooks");

    res
      .status(200)
      .json(profile ? (profile.favoriteBooks || []).filter(Boolean) : []);
  } catch (error) {
    next(error);
  }
};

// Add an approved book to the signed-in user's favorites.
export const addFavorite = async (req, res, next) => {
  try {
    const { userId, userName } = await getClerkIdentity(req);
    const { bookId } = req.body ?? {};
    assertObjectId(bookId, "book");

    const book = await Book.findById(bookId);
    if (!book || book.status !== "allowed") {
      throw new ApiError(404, "Book not found");
    }

    const profile = await Profile.findOneAndUpdate(
      { userId },
      {
        $addToSet: { favoriteBooks: book._id },
        $setOnInsert: { userId, username: userName },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).populate("favoriteBooks");

    res.status(201).json((profile.favoriteBooks || []).filter(Boolean));
  } catch (error) {
    next(error);
  }
};

// Remove a book from the signed-in user's favorites.
export const deleteFavorite = async (req, res, next) => {
  try {
    const { userId } = getAuth(req);
    const { bookId } = req.params;
    assertObjectId(bookId, "book");

    const profile = await Profile.findOneAndUpdate(
      { userId },
      { $pull: { favoriteBooks: bookId } },
      { new: true },
    ).populate("favoriteBooks");

    if (!profile) {
      throw new ApiError(404, "Profile not found");
    }

    res.status(200).json({
      message: "Favorite deleted successfully",
      favoriteBooks: (profile.favoriteBooks || []).filter(Boolean),
    });
  } catch (error) {
    next(error);
  }
};
