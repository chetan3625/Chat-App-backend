const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function serializeReactions(reactions = []) {
  return reactions.map((reaction) => ({
    emoji: reaction.emoji,
    userId: reaction.userId.toString(),
  }));
}

function buildMessagePayload(message) {
  return {
    _id: message._id.toString(),
    conversationId: message.conversationId.toString(),
    senderId: message.senderId.toString(),
    receiverId: message.receiverId.toString(),
    content: message.content,
    clientMessageId: message.clientMessageId,
    type: message.type,
    createdAt: message.createdAt,
    isRead: message.isRead,
    status: message.status,
    reactions: serializeReactions(message.reactions),
  };
}

function emitToMessageUsers(io, eventName, message, payload) {
  const rooms = new Set([
    message.senderId.toString(),
    message.receiverId.toString(),
  ]);

  for (const room of rooms) {
    io.to(room).emit(eventName, payload);
  }
}

async function findOrCreateConversation({ conversationId, senderId, receiverId }) {
  let conversation = conversationId
    ? await Conversation.findOne({ _id: conversationId, participants: senderId })
    : null;

  if (conversationId && !conversation) {
    throw httpError(404, 'Conversation not found.');
  }

  if (
    conversation &&
    !conversation.participants.some(
      (participantId) => participantId.toString() === receiverId.toString(),
    )
  ) {
    throw httpError(403, 'Receiver is not part of this conversation.');
  }

  if (!conversation) {
    conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId], $size: 2 },
    });
  }

  if (!conversation) {
    conversation = await Conversation.create({
      participants: [senderId, receiverId],
    });
  }

  return conversation;
}

async function createOutgoingMessage({
  conversationId,
  senderId,
  receiverId,
  content,
  clientMessageId,
}) {
  const trimmedContent = content?.trim();
  if (!receiverId || !trimmedContent) {
    throw httpError(400, 'Receiver and message content are required.');
  }

  const normalizedClientMessageId = clientMessageId
    ? clientMessageId.toString()
    : null;

  if (normalizedClientMessageId) {
    const existingMessage = await Message.findOne({
      senderId,
      clientMessageId: normalizedClientMessageId,
    });

    if (existingMessage) {
      return {
        conversation: await Conversation.findById(existingMessage.conversationId),
        message: existingMessage,
      };
    }
  }

  const conversation = await findOrCreateConversation({
    conversationId,
    senderId,
    receiverId,
  });

  let message;
  try {
    message = await Message.create({
      conversationId: conversation._id,
      senderId,
      receiverId,
      content: trimmedContent,
      clientMessageId: normalizedClientMessageId,
      type: 'text',
      status: 'sent',
      isRead: false,
    });
  } catch (error) {
    if (error.code === 11000 && normalizedClientMessageId) {
      message = await Message.findOne({
        senderId,
        clientMessageId: normalizedClientMessageId,
      });
    }

    if (!message) {
      throw error;
    }
  }

  conversation.lastMessage = message._id;
  conversation.updatedAt = new Date();
  await conversation.save();

  return { conversation, message };
}

function broadcastMessage(io, message) {
  const payload = buildMessagePayload(message);
  emitToMessageUsers(io, 'message_received', message, payload);
  return payload;
}

async function toggleMessageReaction({ messageId, userId, emoji }) {
  if (!emoji) {
    throw httpError(400, 'Emoji is required.');
  }

  const message = await Message.findById(messageId);
  if (!message) {
    throw httpError(404, 'Message not found.');
  }

  const normalizedUserId = userId.toString();
  if (
    message.senderId.toString() !== normalizedUserId &&
    message.receiverId.toString() !== normalizedUserId
  ) {
    throw httpError(403, 'You do not have access to this message.');
  }

  const existingReactionIndex = message.reactions.findIndex(
    (item) =>
      item.userId.toString() === normalizedUserId && item.emoji === emoji,
  );

  if (existingReactionIndex >= 0) {
    message.reactions.splice(existingReactionIndex, 1);
  } else {
    message.reactions = message.reactions.filter(
      (item) => item.userId.toString() !== normalizedUserId,
    );
    message.reactions.push({ emoji, userId });
  }

  await message.save();
  return message;
}

function broadcastReaction(io, message) {
  const payload = {
    messageId: message._id.toString(),
    conversationId: message.conversationId.toString(),
    reactions: serializeReactions(message.reactions),
    message: buildMessagePayload(message),
  };

  emitToMessageUsers(io, 'message_reaction_update', message, payload);
  return payload;
}

module.exports = {
  broadcastMessage,
  broadcastReaction,
  buildMessagePayload,
  createOutgoingMessage,
  toggleMessageReaction,
};
