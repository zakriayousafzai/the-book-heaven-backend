import mongoose from "mongoose";
import { ApiError } from "./apiError.js";

export const assertObjectId = (id, resource = "resource") => {
  if (!mongoose.isObjectIdOrHexString(id)) {
    throw new ApiError(400, `Invalid ${resource} id`);
  }
};
