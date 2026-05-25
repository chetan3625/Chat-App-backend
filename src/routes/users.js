const express = require('express');

const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

router.get('/search', authMiddleware, userController.searchUsers);
router.get('/contacts', authMiddleware, userController.getContacts);
router.patch('/profile', authMiddleware, userController.updateProfile);
router.post('/profile-photo', authMiddleware, upload.single('photo'), userController.uploadProfilePhoto);
router.post('/presence', authMiddleware, userController.updatePresence);

module.exports = router;
