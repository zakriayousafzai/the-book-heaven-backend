import { getAuth } from "@clerk/express";
import Book from "../models/book.model.js";
import Review from "../models/review.model.js";
import Profile from "../models/profile.model.js";
import { getClerkIdentity, isAdmin } from "../middleware/auth.middleware.js";
import { ApiError } from "../utils/apiError.js";
import { assertObjectId } from "../utils/objectId.js";
import { buildPagination, getPagination } from "../utils/pagination.js";
import { pick } from "../utils/pick.js";

const BOOK_WRITABLE_FIELDS = ["title", "author", "genre", "description"];

const canViewUnpublishedBook = async (req, book, userId) => {
  if (!userId) {
    return false;
  }

  return book.userId === userId || (await isAdmin(req));
};

// Retrieve a list of all approved books (paginated)
export const getAllBooks = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const filter = { status: "allowed" };

    const [books, totalItems] = await Promise.all([
      Book.find(filter).sort({ _id: -1 }).skip(skip).limit(limit),
      Book.countDocuments(filter),
    ]);

    res.status(200).json({
      data: books,
      pagination: buildPagination(page, limit, totalItems),
    });
  } catch (error) {
    next(error);
  }
};

// Retrieve a single book by id. Pending/denied books are only visible to their
// owner or an admin, so they cannot be discovered by guessing an id.
export const getBookById = async (req, res, next) => {
  try {
    const { id } = req.params;
    assertObjectId(id, "book");

    const book = await Book.findById(id);
    if (!book) {
      throw new ApiError(404, "Book not found");
    }

    if (book.status !== "allowed") {
      const { isAuthenticated, userId } = getAuth(req);
      const canView =
        isAuthenticated &&
        (await canViewUnpublishedBook(req, book, userId));

      if (!canView) {
        throw new ApiError(404, "Book not found");
      }
    }

    res.status(200).json(book);
  } catch (error) {
    next(error);
  }
};

// Add a new book recommendation. Regular users' books enter moderation;
// admins' books are published immediately.
export const addBook = async (req, res, next) => {
  try {
    const { title, author, genre, description } = req.body ?? {};
    const { userId, userName, role } = await getClerkIdentity(req);

    const newBook = await Book.create({
      title,
      author,
      genre,
      description,
      userId,
      userName,
      status: role === "admin" ? "allowed" : "pending",
    });

    await Profile.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: { userId, username: userName },
        $addToSet: { recommendedBooks: newBook._id },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    res.status(201).json(newBook);
  } catch (error) {
    next(error);
  }
};

// Update editable book details. Owners may edit their own books and admins may
// edit any book; moderation fields and ownership cannot be changed via the API.
export const updateBook = async (req, res, next) => {
  try {
    const { id } = req.params;
    assertObjectId(id, "book");

    const { userId, role } = await getClerkIdentity(req);
    const book = await Book.findById(id);

    if (!book) {
      throw new ApiError(404, "Book not found");
    }

    if (book.userId !== userId && role !== "admin") {
      throw new ApiError(403, "You can only update your own books");
    }

    const updates = pick(req.body, BOOK_WRITABLE_FIELDS);
    if (Object.keys(updates).length === 0) {
      throw new ApiError(
        400,
        `Provide at least one editable field: ${BOOK_WRITABLE_FIELDS.join(", ")}`,
      );
    }

    Object.assign(book, updates);
    await book.save();

    res.status(200).json(book);
  } catch (error) {
    next(error);
  }
};

// Remove a book and its reviews, and clean up every profile that references it.
export const deleteBook = async (req, res, next) => {
  try {
    const { id } = req.params;
    assertObjectId(id, "book");

    const { userId, role } = await getClerkIdentity(req);
    const book = await Book.findById(id);

    if (!book) {
      throw new ApiError(404, "Book not found");
    }

    if (book.userId !== userId && role !== "admin") {
      throw new ApiError(403, "You can only delete your own books");
    }

    const deletedBook = await Book.findByIdAndDelete(id);
    await Review.deleteMany({ bookId: id });
    await Profile.updateMany(
      { $or: [{ userId: book.userId }, { favoriteBooks: id }] },
      { $pull: { recommendedBooks: id, favoriteBooks: id } },
    );

    res.status(200).json({
      message: "Book deleted successfully",
      deletedBook,
    });
  } catch (error) {
    next(error);
  }
};
