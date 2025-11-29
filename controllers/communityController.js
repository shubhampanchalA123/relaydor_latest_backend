import Post from "../models/PostModel.js";
import Comment from "../models/CommentModel.js";
import Like from "../models/LikeModel.js";
import Poll from "../models/PollModel.js";
import User from "../models/UserModel.js";

// Create a new post
export const createPost = async (req, res, next) => {
  try {
    const { type, title, content, images, pollId, groupId, visibility } = req.body;
    const author = req.user._id;

    const newPost = new Post({
      author,
      type,
      title,
      content,
      images: images || [],
      poll: pollId,
      group: groupId,
      visibility: visibility || "public",
    });

    await newPost.save();

    res.status(201).json({ success: true, message: "Post created", post: newPost });
  } catch (error) {
    next(error);
  }
};

// Get posts feed
export const getPosts = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, type, groupId } = req.query;
    const skip = (page - 1) * limit;

    let filter = {};
    if (type) filter.type = type;
    if (groupId) filter.group = groupId;

    const posts = await Post.find(filter)
      .populate("author", "name profileImage")
      .populate("poll")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Post.countDocuments(filter);

    res.status(200).json({ success: true, posts, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

// Get single post
export const getPostById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const post = await Post.findById(id)
      .populate("author", "name profileImage")
      .populate("poll");

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found" });
    }

    res.status(200).json({ success: true, post });
  } catch (error) {
    next(error);
  }
};

// Update post (only author)
export const updatePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, images, visibility } = req.body;
    const userId = req.user._id;

    const post = await Post.findOneAndUpdate(
      { _id: id, author: userId },
      { title, content, images, visibility },
      { new: true }
    );

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found or unauthorized" });
    }

    res.status(200).json({ success: true, message: "Post updated", post });
  } catch (error) {
    next(error);
  }
};

// Delete post (only author)
export const deletePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const post = await Post.findOneAndDelete({ _id: id, author: userId });

    if (!post) {
      return res.status(404).json({ success: false, message: "Post not found or unauthorized" });
    }

    // Delete related comments and likes
    await Comment.deleteMany({ post: id });
    await Like.deleteMany({ post: id });

    res.status(200).json({ success: true, message: "Post deleted" });
  } catch (error) {
    next(error);
  }
};

// Like/Unlike post
export const likePost = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user._id;

    const existingLike = await Like.findOne({ post: id, user: userId });

    if (existingLike) {
      await Like.findByIdAndDelete(existingLike._id);
      await Post.findByIdAndUpdate(id, { $inc: { likesCount: -1 } });
      res.status(200).json({ success: true, message: "Post unliked" });
    } else {
      const newLike = new Like({ post: id, user: userId });
      await newLike.save();
      await Post.findByIdAndUpdate(id, { $inc: { likesCount: 1 } });
      res.status(200).json({ success: true, message: "Post liked" });
    }
  } catch (error) {
    next(error);
  }
};

// Add comment
export const addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const author = req.user._id;

    const newComment = new Comment({
      post: id,
      author,
      content,
    });

    await newComment.save();
    await Post.findByIdAndUpdate(id, { $inc: { commentsCount: 1 } });

    res.status(201).json({ success: true, message: "Comment added", comment: newComment });
  } catch (error) {
    next(error);
  }
};

// Get comments for a post
export const getComments = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ post: id })
      .populate("author", "name profileImage")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Comment.countDocuments({ post: id });

    res.status(200).json({ success: true, comments, total, page: parseInt(page), pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

// Delete comment (only author)
export const deleteComment = async (req, res, next) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user._id;

    const comment = await Comment.findOneAndDelete({ _id: commentId, post: id, author: userId });

    if (!comment) {
      return res.status(404).json({ success: false, message: "Comment not found or unauthorized" });
    }

    await Post.findByIdAndUpdate(id, { $inc: { commentsCount: -1 } });

    res.status(200).json({ success: true, message: "Comment deleted" });
  } catch (error) {
    next(error);
  }
};

// Create poll
export const createPoll = async (req, res, next) => {
  try {
    const { question, options } = req.body;
    const createdBy = req.user._id;

    const newPoll = new Poll({
      question,
      options: options.map(opt => ({ text: opt, votes: [] })),
      createdBy,
    });

    await newPoll.save();

    res.status(201).json({ success: true, message: "Poll created", poll: newPoll });
  } catch (error) {
    next(error);
  }
};

// Vote on poll
export const votePoll = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { optionIndex } = req.body;
    const userId = req.user._id;

    const poll = await Poll.findById(id);

    if (!poll) {
      return res.status(404).json({ success: false, message: "Poll not found" });
    }

    // Remove previous vote if any
    poll.options.forEach(opt => {
      opt.votes = opt.votes.filter(vote => vote.toString() !== userId.toString());
    });

    // Add vote to selected option
    if (poll.options[optionIndex]) {
      poll.options[optionIndex].votes.push(userId);
    }

    await poll.save();

    res.status(200).json({ success: true, message: "Vote recorded", poll });
  } catch (error) {
    next(error);
  }
};

// Get poll results
export const getPollResults = async (req, res, next) => {
  try {
    const { id } = req.params;

    const poll = await Poll.findById(id).populate("options.votes", "name");

    if (!poll) {
      return res.status(404).json({ success: false, message: "Poll not found" });
    }

    res.status(200).json({ success: true, poll });
  } catch (error) {
    next(error);
  }
};