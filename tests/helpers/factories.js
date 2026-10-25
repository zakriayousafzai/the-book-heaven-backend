import mongoose from "mongoose";
import Book from "../../models/book.model.js";
import Review from "../../models/review.model.js";
import Profile from "../../models/profile.model.js";

const baseBook = {
  userId: "user_owner",
  userName: "owner",
  title: "Default Book",
  author: "Default Author",
  genre: "Fiction",
  description: "A default book used by the test suite.",
  status: "allowed",
};

export const createBook = (overrides = {}) =>
  Book.create({ ...baseBook, ...overrides });

export const createReview = (bookId, overrides = {}) =>
  Review.create({
    bookId,
    userId: "user_owner",
    reviewerName: "owner",
    rating: 5,
    comment: "An excellent read.",
    ...overrides,
  });

export const createProfile = (overrides = {}) =>
  Profile.create({
    userId: "user_owner",
    username: "owner",
    ...overrides,
  });

export const objectId = () => new mongoose.Types.ObjectId().toString();
