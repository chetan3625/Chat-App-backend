const Conversation = require('../models/Conversation');
const Message = require('../models/Message');

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

exports.reactToMessage = async (req, res) => {
  const { emoji } = req.body;

  if (!emoji) {
    return res.status(400).json({ message: 'Emoji is required.' });
  }

  const message = await Message.findById(req.params.id);
  if (!message) {
    return res.status(404).json({ message: 'Message not found.' });
  }

  const userId = req.user.userId.toString();
  if (
    message.senderId.toString() !== userId &&
    message.receiverId.toString() !== userId
  ) {
    return res.status(403).json({ message: 'You do not have access to this message.' });
  }

  const existingReactionIndex = message.reactions.findIndex(
    (item) => item.userId.toString() === userId && item.emoji === emoji,
  );

  if (existingReactionIndex >= 0) {
    message.reactions.splice(existingReactionIndex, 1);
  } else {
    message.reactions = message.reactions.filter(
      (item) => item.userId.toString() !== userId,
    );
    message.reactions.push({ emoji, userId: req.user.userId });
  }

  await message.save();

  return res.json({ message });
};
