const express = require('express');

const messageController = require('../controllers/messageController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

router.post('/', authMiddleware, messageController.sendMessage);
router.get('/:id', authMiddleware, messageController.getMessages);
router.patch('/read/:id', authMiddleware, messageController.markMessagesRead);
router.patch('/:id/react', authMiddleware, messageController.reactToMessage);

module.exports = router;
