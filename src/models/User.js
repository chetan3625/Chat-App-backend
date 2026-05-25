const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    username: { type: String, required: true, unique: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true },
    bio: { type: String, default: 'Hey there! I am using Chetanu.' },
    status: { type: String, default: 'Hey there! I am using Chetanu.' },
    avatarUrl: { type: String, default: '' },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: null },
  },
  {
    timestamps: true,
  },
);

module.exports = mongoose.model('User', userSchema);
