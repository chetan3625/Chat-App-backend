const express = require('express');

const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.get('/', authMiddleware, chatController.getConversations);
router.get('/:id', authMiddleware, chatController.getConversationById);

module.exports = router;
