import { getAuth } from "@clerk/express";
import Review from "../models/review.model.js";
import Book from "../models/book.model.js";
import { getClerkIdentity, isAdmin } from "../middleware/auth.middleware.js";
import { ApiError } from "../utils/apiError.js";
import { assertObjectId } from "../utils/objectId.js";
import { buildPagination, getPagination } from "../utils/pagination.js";
import { pick } from "../utils/pick.js";

const REVIEW_WRITABLE_FIELDS = ["rating", "comment"];

const canViewUnpublishedBook = async (req, book) => {
  const { isAuthenticated, userId } = getAuth(req);
  return (
    isAuthenticated &&
    (book.userId === userId || (await isAdmin(req)))
  );
};

// Get all reviews for a specific approved book (paginated). Owners and admins
// can also view reviews for a book that is still in moderation.
export const getReviewsForBook = async (req, res, next) => {
  try {
    const { id } = req.params;
    assertObjectId(id, "book");

    const book = await Book.findById(id);
    if (!book) {
      throw new ApiError(404, "Book not found");
    }

    if (
      book.status !== "allowed" &&
      !(await canViewUnpublishedBook(req, book))
    ) {
      throw new ApiError(404, "Book not found");
    }

    const { page, limit, skip } = getPagination(req.query);

    const [reviews, totalItems] = await Promise.all([
      Review.find({ bookId: id })
        .sort({ _id: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments({ bookId: id }),
    ]);

    res.status(200).json({
      data: reviews,
      pagination: buildPagination(page, limit, totalItems),
    });
  } catch (error) {
    next(error);
  }
};

// Create a new review for an approved book.
export const createReviewForBook = async (req, res, next) => {
  try {
    const { id } = req.params;
    assertObjectId(id, "book");

    const book = await Book.findById(id);
    if (!book) {
      throw new ApiError(404, "Book not found");
    }

    if (book.status !== "allowed") {
      throw new ApiError(403, "Cannot review a book that is not approved yet");
    }

    const { rating, comment } = req.body ?? {};
    const { userId, userName } = await getClerkIdentity(req);

    const newReview = await Review.create({
      bookId: id,
      userId,
      reviewerName: userName,
      rating,
      comment,
    });

    res.status(201).json({
      message: "Review added successfully",
      newReview,
    });
  } catch (error) {
    next(error);
  }
};

// Update a review. Only the author or an admin may do this, and only the
// rating/comment fields can be changed.
export const updateReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    assertObjectId(id, "review");

    const { userId, role } = await getClerkIdentity(req);
    const review = await Review.findById(id);

    if (!review) {
      throw new ApiError(404, "Review not found");
    }

    if (review.userId !== userId && role !== "admin") {
      throw new ApiError(403, "You can only update your own reviews");
    }

    const updates = pick(req.body, REVIEW_WRITABLE_FIELDS);
    if (Object.keys(updates).length === 0) {
      throw new ApiError(
        400,
        `Provide at least one editable field: ${REVIEW_WRITABLE_FIELDS.join(", ")}`,
      );
    }

    Object.assign(review, updates);
    await review.save();

    res.status(200).json({
      message: "Review updated successfully",
      updatedReview: review,
    });
  } catch (error) {
    next(error);
  }
};

// Delete a review (author or admin only).
export const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params;
    assertObjectId(id, "review");

    const { userId, role } = await getClerkIdentity(req);
    const review = await Review.findById(id);

    if (!review) {
      throw new ApiError(404, "Review not found");
    }

    if (review.userId !== userId && role !== "admin") {
      throw new ApiError(403, "You can only delete your own reviews");
    }

    const deletedReview = await Review.findByIdAndDelete(id);

    res.status(200).json({
      message: "Review deleted successfully",
      deletedReview,
    });
  } catch (error) {
    next(error);
  }
};
