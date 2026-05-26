const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const {
  broadcastMessage,
  broadcastReaction,
  createOutgoingMessage,
  toggleMessageReaction,
} = require('../services/messageRealtime');

exports.getMessages = async (req, res) => {
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    participants: req.user.userId,
  });

  if (!conversation) {
    return res.status(404).json({ message: 'Conversation not found.' });
  }

  const messages = await Message.find({ conversationId: conversation._id }).sort({ createdAt: 1 });

  return res.json({ messages });
};

exports.markMessagesRead = async (req, res) => {
  const conversation = await Conversation.findOne({
    _id: req.params.id,
    participants: req.user.userId,
  });

  if (!conversation) {
    return res.status(404).json({ message: 'Conversation not found.' });
  }

  const result = await Message.updateMany(
    {
      conversationId: conversation._id,
      receiverId: req.user.userId,
      isRead: false,
    },
    { isRead: true, status: 'read' },
  );

  return res.json({
    message: 'Messages marked as read.',
    updatedCount: result.modifiedCount ?? result.nModified ?? 0,
  });
};

exports.sendMessage = async (req, res) => {
  try {
    const { conversationId, receiverId, content, clientMessageId } = req.body;
    const { message } = await createOutgoingMessage({
      conversationId,
      senderId: req.user.userId,
      receiverId,
      content,
      clientMessageId,
    });

    const payload = req.io
      ? broadcastMessage(req.io, message)
      : message;

    return res.json({ message: payload });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || 'Unable to send message.',
    });
  }
};

exports.reactToMessage = async (req, res) => {
  const { emoji } = req.body;

  try {
    const message = await toggleMessageReaction({
      messageId: req.params.id,
      userId: req.user.userId,
      emoji,
    });

    const payload = req.io
      ? broadcastReaction(req.io, message).message
      : message;

    return res.json({ message: payload });
  } catch (error) {
    return res.status(error.status || 500).json({
      message: error.message || 'Unable to update reaction.',
    });
  }
};
