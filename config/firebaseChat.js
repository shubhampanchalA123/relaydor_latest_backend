import admin from "firebase-admin";

// Get database reference
const db = admin.database();

// Chat operations
export const firebaseChat = {
  // Send message
  async sendMessage(conversationId, messageData) {
    try {
      const messageRef = db.ref(`chats/${conversationId}/messages`).push();
      await messageRef.set({
        ...messageData,
        timestamp: admin.database.ServerValue.TIMESTAMP,
        id: messageRef.key
      });
      return messageRef.key;
    } catch (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }
  },

  // Get messages for a conversation
  async getMessages(conversationId, limit = 50) {
    try {
      const messagesRef = db.ref(`chats/${conversationId}/messages`)
        .orderByChild('timestamp')
        .limitToLast(limit);

      const snapshot = await messagesRef.once('value');
      const messages = [];

      snapshot.forEach(childSnapshot => {
        messages.push({
          id: childSnapshot.key,
          ...childSnapshot.val()
        });
      });

      return messages;
    } catch (error) {
      throw new Error(`Failed to get messages: ${error.message}`);
    }
  },

  // Get user's conversations
  async getUserConversations(userId) {
    try {
      const conversationsRef = db.ref('conversations');
      const snapshot = await conversationsRef.once('value');
      const conversations = [];

      snapshot.forEach(childSnapshot => {
        const conversation = childSnapshot.val();
        if (conversation.participants && conversation.participants.includes(userId)) {
          conversations.push({
            id: childSnapshot.key,
            ...conversation
          });
        }
      });

      return conversations;
    } catch (error) {
      throw new Error(`Failed to get conversations: ${error.message}`);
    }
  },

  // Create or get conversation
  async getOrCreateConversation(participants, conversationType) {
    try {
      const conversationsRef = db.ref('conversations');
      const snapshot = await conversationsRef.once('value');

      // Check if conversation already exists
      let existingConversation = null;
      snapshot.forEach(childSnapshot => {
        const conversation = childSnapshot.val();
        if (conversation.participants &&
            conversation.participants.length === participants.length &&
            conversation.participants.every(p => participants.includes(p)) &&
            conversation.conversationType === conversationType) {
          existingConversation = {
            id: childSnapshot.key,
            ...conversation
          };
        }
      });

      if (existingConversation) {
        return existingConversation;
      }

      // Create new conversation
      const newConversationRef = conversationsRef.push();
      const conversationData = {
        participants: participants.sort(),
        conversationType,
        createdAt: admin.database.ServerValue.TIMESTAMP,
        lastMessage: '',
        lastMessageTime: admin.database.ServerValue.TIMESTAMP
      };

      await newConversationRef.set(conversationData);
      return {
        id: newConversationRef.key,
        ...conversationData
      };
    } catch (error) {
      throw new Error(`Failed to create conversation: ${error.message}`);
    }
  },

  // Update conversation last message
  async updateConversationLastMessage(conversationId, message, senderId) {
    try {
      await db.ref(`conversations/${conversationId}`).update({
        lastMessage: message,
        lastMessageTime: admin.database.ServerValue.TIMESTAMP,
        lastMessageSender: senderId
      });
    } catch (error) {
      throw new Error(`Failed to update conversation: ${error.message}`);
    }
  },

  // Mark messages as read
  async markMessagesAsRead(conversationId, userId) {
    try {
      const messagesRef = db.ref(`chats/${conversationId}/messages`);
      const snapshot = await messagesRef.once('value');

      const updates = {};
      snapshot.forEach(childSnapshot => {
        const message = childSnapshot.val();
        if (message.receiverId === userId && message.status !== 'read') {
          updates[`${childSnapshot.key}/status`] = 'read';
          updates[`${childSnapshot.key}/isRead`] = true;
          updates[`${childSnapshot.key}/readAt`] = admin.database.ServerValue.TIMESTAMP;
        }
      });

      if (Object.keys(updates).length > 0) {
        await messagesRef.update(updates);
      }
    } catch (error) {
      throw new Error(`Failed to mark messages as read: ${error.message}`);
    }
  },

  // Update online status
  async updateOnlineStatus(userId, status) {
    try {
      const statusRef = db.ref(`onlineStatus/${userId}`);
      await statusRef.set({
        status,
        lastSeen: status === 'offline' ? admin.database.ServerValue.TIMESTAMP : null,
        timestamp: admin.database.ServerValue.TIMESTAMP
      });
    } catch (error) {
      throw new Error(`Failed to update online status: ${error.message}`);
    }
  },

  // Get online status
  async getOnlineStatus(userId) {
    try {
      const statusRef = db.ref(`onlineStatus/${userId}`);
      const snapshot = await statusRef.once('value');
      const data = snapshot.val();

      if (!data) return 'offline';

      // Consider offline if last seen more than 5 minutes ago
      if (data.status === 'offline' ||
          (data.timestamp && Date.now() - data.timestamp > 5 * 60 * 1000)) {
        return 'offline';
      }

      return data.status;
    } catch (error) {
      console.error(`Failed to get online status: ${error.message}`);
      return 'offline';
    }
  },

  // Get multiple online statuses
  async getOnlineStatuses(userIds) {
    try {
      const statuses = {};
      for (const userId of userIds) {
        statuses[userId] = await this.getOnlineStatus(userId);
      }
      return statuses;
    } catch (error) {
      throw new Error(`Failed to get online statuses: ${error.message}`);
    }
  }
};