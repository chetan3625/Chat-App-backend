const express = require('express');

const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, chatController.getConversations);
router.post('/:userId', authMiddleware, chatController.findOrCreateConversation);
router.get('/:id', authMiddleware, chatController.getConversationById);

module.exports = router;
