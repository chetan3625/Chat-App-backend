const jwt = require('jsonwebtoken');

const User = require('../models/User');

function signToken(user) {
  return jwt.sign(
    { userId: user._id.toString(), phone: user.phone },
    process.env.JWT_SECRET,
    { expiresIn: '7d' },
  );
}

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

exports.registerOrLogin = async (req, res) => {
  const { phone, username } = req.body;

  if (!phone || !username) {
    return res.status(400).json({ message: 'Phone and username are required.' });
  }

  const normalizedPhone = phone.trim();
  const normalizedUsername = username.trim();

  let user = await User.findOne({ phone: normalizedPhone });

  if (user) {
    user = await User.findByIdAndUpdate(
      user._id,
      {
        username: normalizedUsername,
        isOnline: true,
        lastSeen: null,
      },
      { new: true },
    );

    return res.json({ user: sanitizeUser(user), token: signToken(user) });
  }

  const existingUsername = await User.findOne({ username: normalizedUsername });
  if (existingUsername) {
    return res.status(409).json({ message: 'Username already taken.' });
  }

  user = await User.create({
    name: normalizedUsername,
    username: normalizedUsername,
    phone: normalizedPhone,
    bio: 'Hey there! I am using Chetanu.',
    status: 'Hey there! I am using Chetanu.',
    isOnline: true,
    lastSeen: null,
  });

  return res.json({ user: sanitizeUser(user), token: signToken(user) });
};

exports.getMe = async (req, res) => {
  const user = await User.findById(req.user.userId);

  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  return res.json({ user: sanitizeUser(user) });
};
