import mongoose from "mongoose";

const postSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["text", "case", "announcement", "event"],
      required: true,
    },
    title: {
      type: String,
      trim: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    images: [{
      type: String, // file paths
    }],
    poll: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Poll",
    },
    // For groups/circles
    group: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
    },
    // Privacy: public or group-only
    visibility: {
      type: String,
      enum: ["public", "group"],
      default: "public",
    },
    likesCount: {
      type: Number,
      default: 0,
    },
    commentsCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Post", postSchema);