import Book from "../models/book.model.js";
import { ApiError } from "../utils/apiError.js";
import { assertObjectId } from "../utils/objectId.js";
import { buildPagination, getPagination } from "../utils/pagination.js";

const MODERATION_STATUSES = ["pending", "allowed", "denied"];

// List books by moderation status (defaults to pending).
export const showPendingBooks = async (req, res, next) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const status = req.query.status ?? "pending";

    if (!MODERATION_STATUSES.includes(status)) {
      throw new ApiError(
        400,
        `status must be one of: ${MODERATION_STATUSES.join(", ")}`,
      );
    }

    const filter = { status };

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

export const approveBook = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    assertObjectId(bookId, "book");

    const book = await Book.findByIdAndUpdate(
      bookId,
      { status: "allowed" },
      { new: true, runValidators: true },
    );

    if (!book) {
      throw new ApiError(404, "Book not found");
    }

    res.status(200).json({ message: "Book approved successfully", book });
  } catch (error) {
    next(error);
  }
};

export const denyBook = async (req, res, next) => {
  try {
    const { bookId } = req.params;
    assertObjectId(bookId, "book");

    const book = await Book.findByIdAndUpdate(
      bookId,
      { status: "denied" },
      { new: true, runValidators: true },
    );

    if (!book) {
      throw new ApiError(404, "Book not found");
    }

    res.status(200).json({ message: "Book denied successfully", book });
  } catch (error) {
    next(error);
  }
};
