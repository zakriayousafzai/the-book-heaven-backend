import Book from "../models/book.model.js";
import { ApiError } from "../utils/apiError.js";
import { escapeRegExp } from "../utils/escapeRegex.js";
import { buildPagination, getPagination } from "../utils/pagination.js";

// Search approved books by title, author, genre, or description.
export const searchBooks = async (req, res, next) => {
  try {
    const query = req.query.q?.trim();

    if (!query) {
      throw new ApiError(400, "Search query is required");
    }

    if (query.length > 200) {
      throw new ApiError(400, "Search query must be 200 characters or fewer");
    }

    const { page, limit, skip } = getPagination(req.query);
    const regex = new RegExp(escapeRegExp(query), "i");
    const filter = {
      status: "allowed",
      $or: [
        { title: regex },
        { author: regex },
        { genre: regex },
        { description: regex },
      ],
    };

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
