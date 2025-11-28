import User from "../models/UserModel.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { firebaseChat } from "../config/firebaseChat.js";

// Helper function to generate conversation ID
function generateConversationId(participants) {
  return participants.sort().join("_");
}

// Send message
const sendMessage = async (req, res) => {
  try {
    const { receiverId, message, messageType = "text", conversationId: providedConversationId } = req.body;
    const senderId = req.user._id.toString();
    const senderRole = req.user.userRole;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    let conversation;
    let conversationId;
    let finalReceiverId = receiverId;

    if (providedConversationId) {
      // Use existing conversation
      conversationId = providedConversationId;
      // Verify the conversation exists and user is part of it
      const conversations = await firebaseChat.getUserConversations(senderId);
      conversation = conversations.find(conv => conv.id === conversationId);
      if (!conversation) {
        return res.status(403).json({
          success: false,
          message: "Conversation not found or access denied",
        });
      }

      // Find the other participant as receiver
      finalReceiverId = conversation.participants.find(p => p !== senderId);
      if (!finalReceiverId) {
        return res.status(400).json({
          success: false,
          message: "Cannot determine receiver from conversation",
        });
      }
    } else {
      // New conversation - need receiverId
      if (!receiverId) {
        return res.status(400).json({
          success: false,
          message: "Receiver ID is required for new conversations",
        });
      }

      finalReceiverId = receiverId;
    }

    // Validate receiver exists
    const receiver = await User.findById(finalReceiverId);
    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: "Receiver not found",
      });
    }

    // Role validation
    if (senderRole === "doctor" && receiver.userRole === "doctor") {
      // Doctor to doctor - allowed
    } else if ((senderRole === "doctor" || senderRole === "admin") && receiver.userRole === "admin") {
      // Doctor or admin to admin - allowed
    } else if (senderRole === "admin" && (receiver.userRole === "doctor" || receiver.userRole === "admin")) {
      // Admin to doctor or admin - allowed
    } else {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to send message to this user",
      });
    }

    if (!providedConversationId) {
      // Generate conversation ID and create new conversation
      const participants = [senderId, finalReceiverId].sort();
      conversationId = generateConversationId(participants);

      // Get or create conversation in Firebase
      const conversationType = senderRole === "doctor" && receiver.userRole === "doctor" ? "doctor-doctor" : "doctor-admin";
      conversation = await firebaseChat.getOrCreateConversation(participants, conversationType);
      conversationId = conversation.id; // Use Firebase-generated ID
    }

    // Encrypt message
    const encryptedMessage = encrypt(message);

    // Create message data
    const messageData = {
      conversationId,
      senderId,
      receiverId: finalReceiverId,
      message: encryptedMessage,
      messageType,
      status: 'sent', // sent, delivered, read
      isRead: false,
      senderName: req.user.name,
      senderRole: req.user.userRole,
      receiverName: receiver.name,
      receiverRole: receiver.userRole,
      timestamp: Date.now()
    };

    // Send message to Firebase
    const messageId = await firebaseChat.sendMessage(conversationId, messageData);

    // Update conversation last message
    await firebaseChat.updateConversationLastMessage(conversationId, message, senderId);

    // Decrypt for response
    messageData.message = decrypt(messageData.message);
    messageData.id = messageId;

    res.status(201).json({
      success: true,
      message: "Message sent successfully",
      data: messageData,
    });

  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get messages for a conversation
const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
    }

    // Verify user is part of conversation (check with Firebase)
    const conversations = await firebaseChat.getUserConversations(userId);
    const conversation = conversations.find(conv => conv.id === conversationId);

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to access this conversation",
      });
    }

    // Get messages from Firebase
    const messages = await firebaseChat.getMessages(conversationId);

    // Decrypt messages (with error handling for old encrypted data)
    messages.forEach(msg => {
      if (msg.message) {
        try {
          msg.message = decrypt(msg.message);
        } catch (error) {
          console.warn('Failed to decrypt message:', msg.id, error.message);
          // Keep encrypted message or mark as corrupted
          msg.message = '[Message could not be decrypted]';
        }
      }
    });

    res.status(200).json({
      success: true,
      data: messages,
    });

  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Get user's conversations
const getConversations = async (req, res) => {
  try {
    const userId = req.user._id.toString();
    const userRole = req.user.userRole;

    // Get conversations from Firebase
    const conversations = await firebaseChat.getUserConversations(userId);

    // Filter based on role and populate user data
    const filteredConversations = [];
    for (const conv of conversations) {
      let includeConversation = false;

      if (userRole === "doctor") {
        includeConversation = conv.conversationType === "doctor-doctor" || conv.conversationType === "doctor-admin";
      } else if (userRole === "admin") {
        includeConversation = conv.conversationType === "doctor-admin";
      }

      if (includeConversation) {
        // Populate participant data
        const populatedParticipants = [];
        for (const participantId of conv.participants) {
          const user = await User.findById(participantId).select("name userRole profileImage");
          if (user) {
            populatedParticipants.push(user);
          }
        }
        conv.participants = populatedParticipants;
        filteredConversations.push(conv);
      }
    }

    // Sort by last message time
    filteredConversations.sort((a, b) => (b.lastMessageTime || 0) - (a.lastMessageTime || 0));

    res.status(200).json({
      success: true,
      data: filteredConversations,
    });

  } catch (error) {
    console.error("Get conversations error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Mark messages as read
const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id.toString();

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Conversation ID is required",
      });
    }

    // Verify user is part of conversation
    const conversations = await firebaseChat.getUserConversations(userId);
    const conversation = conversations.find(conv => conv.id === conversationId);

    if (!conversation) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to access this conversation",
      });
    }

    // Mark messages as read in Firebase
    await firebaseChat.markMessagesAsRead(conversationId, userId);

    res.status(200).json({
      success: true,
      message: "Messages marked as read",
    });

  } catch (error) {
    console.error("Mark as read error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Update online status
const updateOnlineStatus = async (req, res) => {
  try {
    const { status } = req.body; // 'online' or 'offline'
    const userId = req.user._id.toString();

    // Update online status in Firebase
    await firebaseChat.updateOnlineStatus(userId, status);

    res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
    });
  } catch (error) {
    console.error('Update online status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get online status of users
const getOnlineStatuses = async (req, res) => {
  try {
    const userIds = req.query.users ? req.query.users.split(',') : [];
    const statuses = {};

    for (const userId of userIds) {
      const status = await firebaseChat.getOnlineStatus(userId);
      statuses[userId] = status || 'offline';
    }

    res.status(200).json({
      success: true,
      data: statuses,
    });
  } catch (error) {
    console.error('Get online statuses error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// Get list of users available for chat
const getChatUsers = async (req, res) => {
  try {
    const currentUserId = req.user._id.toString();
    const currentUserRole = req.user.userRole;

    // Define which roles can chat with whom
    let allowedRoles = [];
    if (currentUserRole === "doctor") {
      allowedRoles = ["doctor", "admin"];
    } else if (currentUserRole === "admin") {
      allowedRoles = ["doctor", "admin"];
    }

    // Get users with allowed roles (excluding current user)
    const users = await User.find({
      _id: { $ne: currentUserId },
      userRole: { $in: allowedRoles },
      verified: true
    }).select("name userRole profileImage clinicAddress hospitalAddress availabilityStatus");

    // Get online statuses for these users
    const userIds = users.map(user => user._id.toString());
    let onlineStatuses = {};

    if (userIds.length > 0) {
      try {
        onlineStatuses = await firebaseChat.getOnlineStatuses(userIds);
      } catch (error) {
        console.warn('Failed to get online statuses:', error);
        // Continue without online status
      }
    }

    // Format response
    const chatUsers = users.map(user => ({
      id: user._id,
      name: user.name,
      role: user.userRole,
      profileImage: user.profileImage,
      clinicAddress: user.clinicAddress,
      hospitalAddress: user.hospitalAddress,
      availabilityStatus: user.availabilityStatus,
      isOnline: onlineStatuses[user._id.toString()] === 'online'
    }));

    res.status(200).json({
      success: true,
      data: chatUsers
    });

  } catch (error) {
    console.error("Get chat users error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};

export { sendMessage, getMessages, getConversations, markAsRead, updateOnlineStatus, getOnlineStatuses, getChatUsers };