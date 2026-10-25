import mongoose from "mongoose";

// Reviews Schema
const reviewSchema = new mongoose.Schema({
  bookId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    required: true
  },
  userId: {
    type: String,
    required: true
  },
  reviewerName: {
    type: String,
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
    validate: {
      validator: Number.isInteger,
      message: "Rating must be a whole number between 1 and 5",
    },
  },
  comment: {
    type: String,
    required: true
  }
});

const Review = mongoose.model('Review', reviewSchema);

export default Review;