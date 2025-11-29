import mongoose from "mongoose";

const pollSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: [{
      text: {
        type: String,
        required: true,
        trim: true,
      },
      votes: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      }],
    }],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    // Optional: link to post if poll is part of a post
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
    },
  },
  { timestamps: true }
);

export default mongoose.model("Poll", pollSchema);