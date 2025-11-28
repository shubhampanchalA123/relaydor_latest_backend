import express from "express";
import { sendMessage, getMessages, getConversations, markAsRead, updateOnlineStatus, getOnlineStatuses, getChatUsers } from "../controllers/chatController.js";
import authMiddleware from "../middlewares/authMiddleware.js";

const router = express.Router();

// Send message
router.post("/send-message", authMiddleware, sendMessage);

// Get user's conversations
router.get("/conversations", authMiddleware, getConversations);

// Get messages for a specific conversation
router.get("/messages/:conversationId", authMiddleware, getMessages);

// Mark messages as read in a conversation
router.put("/mark-read/:conversationId", authMiddleware, markAsRead);

// Update online status
router.post("/online-status", authMiddleware, updateOnlineStatus);

// Get online statuses
router.get("/online-statuses", authMiddleware, getOnlineStatuses);

// Get list of users available for chat
router.get("/users", authMiddleware, getChatUsers);

export default router;