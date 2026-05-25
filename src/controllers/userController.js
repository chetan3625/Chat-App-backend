const path = require('path');

const User = require('../models/User');

function sanitizeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    username: user.username,
    phone: user.phone,
    bio: user.bio,
    status: user.status,
    avatarUrl: user.avatarUrl,
    isOnline: user.isOnline,
    lastSeen: user.lastSeen,
  };
}

exports.updateProfile = async (req, res) => {
  const { username, bio, status } = req.body;

  if (!username) {
    return res.status(400).json({ message: 'Username is required.' });
  }

  const existing = await User.findOne({ username, _id: { $ne: req.user.userId } });
  if (existing) {
    return res.status(409).json({ message: 'Username already taken.' });
  }

  const user = await User.findByIdAndUpdate(
    req.user.userId,
    {
      username,
      bio: bio ?? 'Hey there! I am using Chetanu.',
      status: status ?? 'Hey there! I am using Chetanu.',
    },
    { new: true },
  );

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  return res.json({ user: sanitizeUser(user) });
};

exports.searchUsers = async (req, res) => {
  const query = req.query.query?.toString().trim() || '';

  if (!query) {
    return res.json({ users: [] });
  }

  const users = await User.find({
    _id: { $ne: req.user.userId },
    $or: [
      { username: { $regex: query, $options: 'i' } },
      { name: { $regex: query, $options: 'i' } },
      { phone: { $regex: query, $options: 'i' } },
    ],
  })
    .limit(20)
    .select('name username phone avatarUrl status isOnline lastSeen');

  return res.json({ users });
};

exports.getContacts = async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user.userId } })
    .select('name username phone avatarUrl status isOnline lastSeen')
    .limit(50);

  return res.json({ users });
};

exports.uploadProfilePhoto = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'A profile photo is required.' });
  }

  const baseUrl = (process.env.BASE_URL || 'http://10.0.0.2:4000').replace(/\/$/, '');
  const avatarUrl = `${baseUrl}/uploads/profile-photos/${req.file.filename}`;
  const user = await User.findByIdAndUpdate(
    req.user.userId,
    { avatarUrl },
    { new: true },
  );

  return res.json({ avatarUrl, user: sanitizeUser(user) });
};

exports.updatePresence = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.user.userId,
    { isOnline: true, lastSeen: null },
    { new: true },
  );

  return res.json({ user: sanitizeUser(user) });
};
