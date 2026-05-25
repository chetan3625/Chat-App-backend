const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');

function buildConversationSummary(conversation, currentUserId) {
  const participant = conversation.participants.find((item) => item._id.toString() !== currentUserId.toString());

  return {
    _id: conversation._id,
    participant: participant
      ? {
          _id: participant._id,
          name: participant.name,
          username: participant.username,
          phone: participant.phone,
          avatarUrl: participant.avatarUrl,
          status: participant.status,
          isOnline: participant.isOnline,
          lastSeen: participant.lastSeen,
        }
      : null,
    updatedAt: conversation.updatedAt,
    lastMessage: conversation.lastMessage
      ? {
          _id: conversation.lastMessage._id,
          content: conversation.lastMessage.content,
          createdAt: conversation.lastMessage.createdAt,
          senderId: conversation.lastMessage.senderId,
        }
      : null,
  };
}

exports.getConversations = async (req, res) => {
  const userId = req.user.userId;

  const conversations = await Conversation.find({ participants: userId })
    .populate({
      path: 'participants',
      select: 'name username phone avatarUrl status isOnline lastSeen',
    })
    .populate({
      path: 'lastMessage',
      select: 'content createdAt senderId receiverId',
    })
    .sort({ updatedAt: -1 });

  const data = conversations.map((conversation) => buildConversationSummary(conversation, userId));

  return res.json({ conversations: data });
};

exports.getConversationById = async (req, res) => {
  const userId = req.user.userId;

  const conversation = await Conversation.findOne({
    _id: req.params.id,
    participants: userId,
  }).populate({
    path: 'participants',
    select: 'name username phone avatarUrl status isOnline lastSeen',
  });

  if (!conversation) {
    return res.status(404).json({ message: 'Conversation not found.' });
  }

  return res.json({ conversation: buildConversationSummary(conversation, userId) });
};
