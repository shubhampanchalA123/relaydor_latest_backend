import express from "express";
import {
  createPost,
  getPosts,
  getPostById,
  updatePost,
  deletePost,
  likePost,
  addComment,
  getComments,
  deleteComment,
  createPoll,
  votePoll,
  getPollResults,
} from "../controllers/communityController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

// Post routes
router.post("/posts", authMiddleware, createPost);
router.get("/posts", authMiddleware, getPosts);
router.get("/posts/:id", authMiddleware, getPostById);
router.put("/posts/:id", authMiddleware, updatePost);
router.delete("/posts/:id", authMiddleware, deletePost);

// Like route
router.post("/posts/:id/like", authMiddleware, likePost);

// Comment routes
router.post("/posts/:id/comments", authMiddleware, addComment);
router.get("/posts/:id/comments", authMiddleware, getComments);
router.delete("/posts/:id/comments/:commentId", authMiddleware, deleteComment);

// Poll routes
router.post("/polls", authMiddleware, createPoll);
router.post("/polls/:id/vote", authMiddleware, votePoll);
router.get("/polls/:id/results", authMiddleware, getPollResults);

export default router;