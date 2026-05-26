const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');

const Conversation = require('./models/Conversation');
const Message = require('./models/Message');
const User = require('./models/User');
const {
  broadcastMessage,
  broadcastReaction,
  createOutgoingMessage,
  toggleMessageReaction,
} = require('./services/messageRealtime');

function setupSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: '*',
    },
  });

  io.use((socket, next) => {
    const authHeader = socket.handshake.headers.authorization || '';
    let token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    if (!token && socket.handshake.auth) {
      token = socket.handshake.auth.token;
    }

    if (!token && socket.handshake.query) {
      token = socket.handshake.query.token;
    }

    if (!token) {
      console.log('Socket connection failed: No token provided');
      return next(new Error('Unauthorized'));
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = payload.userId;
      console.log(`Socket authenticated user: ${socket.userId}`);
      next();
    } catch (error) {
      console.log(`Socket authentication failed for token: ${error.message}`);
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(socket.userId);
    console.log(`Socket connected: ${socket.id} (User: ${socket.userId})`);

    const broadcastPresence = async (isOnline) => {
      await User.findByIdAndUpdate(socket.userId, {
        isOnline,
        lastSeen: isOnline ? null : new Date(),
      });

      io.emit('presence_update', {
        userId: socket.userId,
        isOnline,
        lastSeen: isOnline ? null : new Date().toISOString(),
      });
    };

    void broadcastPresence(true);

    socket.on('typing', async ({ conversationId, recipientId, typing }) => {
      if (!conversationId || !recipientId) {
        return;
      }

      socket.to(recipientId.toString()).emit('typing', {
        conversationId,
        typing: typing === true,
      });
    });

    socket.on('send_message', async (payload, ack) => {
      try {
        const { conversationId, receiverId, content, clientMessageId } = payload || {};
        const { message } = await createOutgoingMessage({
          conversationId,
          senderId: socket.userId,
          receiverId,
          content,
          clientMessageId,
        });

        console.log(`Socket [send_message]: from ${socket.userId} to ${receiverId}`);
        const receiverRoom = io.sockets.adapter.rooms.get(receiverId.toString());
        const numClients = receiverRoom ? receiverRoom.size : 0;
        console.log(`Socket [send_message]: Sending payload to room ${receiverId.toString()} (active clients: ${numClients})`);

        const messagePayload = broadcastMessage(io, message);
        if (typeof ack === 'function') {
          ack({ ok: true, message: messagePayload });
        }
      } catch (error) {
        console.log(`Socket [send_message] failed: ${error.message}`);
        if (typeof ack === 'function') {
          ack({
            ok: false,
            message: error.message || 'Unable to send message.',
          });
        }
      }
    });

    socket.on('react_to_message', async (payload, ack) => {
      try {
        const { messageId, emoji } = payload || {};
        const message = await toggleMessageReaction({
          messageId,
          emoji,
          userId: socket.userId,
        });
        const reactionPayload = broadcastReaction(io, message);
        if (typeof ack === 'function') {
          ack({ ok: true, message: reactionPayload.message });
        }
      } catch (error) {
        console.log(`Socket [react_to_message] failed: ${error.message}`);
        if (typeof ack === 'function') {
          ack({
            ok: false,
            message: error.message || 'Unable to update reaction.',
          });
        }
      }
    });

    const updateMessageStatus = async (messageId, status, receiverSocketId) => {
      if (!messageId) {
        return;
      }

      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }

      message.status = status;
      if (status === 'read') {
        message.isRead = true;
      }
      await message.save();

      io.to(message.senderId.toString()).emit('message_status_update', {
        messageId: message._id.toString(),
        status,
      });

      if (receiverSocketId) {
        io.to(receiverSocketId).emit('message_status_update', {
          messageId: message._id.toString(),
          status,
        });
      }
    };

    socket.on('mark_delivered', async ({ messageId }) => {
      const message = await Message.findById(messageId);
      if (!message) {
        return;
      }

      if (message.receiverId.toString() !== socket.userId.toString()) {
        return;
      }

      await updateMessageStatus(messageId, 'delivered');
    });

    socket.on('mark_read', async ({ conversationId }) => {
      if (!conversationId) {
        return;
      }

      const conversation = await Conversation.findById(conversationId);
      if (!conversation) {
        return;
      }

      const messages = await Message.find({
        conversationId,
        receiverId: socket.userId,
        isRead: false,
      });

      for (const message of messages) {
        await updateMessageStatus(message._id, 'read');
      }
    });

    socket.on('mark_seen', async ({ conversationId, senderId }) => {
      if (!conversationId || !senderId) {
        return;
      }

      const messages = await Message.find({
        conversationId,
        receiverId: socket.userId,
        isRead: false,
      });

      for (const message of messages) {
        await updateMessageStatus(message._id, 'read');
      }
    });

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id} (User: ${socket.userId})`);
      await broadcastPresence(false);
    });
  });

  return io;
}

module.exports = setupSocket;
