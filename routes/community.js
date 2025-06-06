
const express = require('express');
const auth = require('../middleware/auth');
const router = express.Router();
const communityController = require('../controllers/communityController');
const commentController = require('../controllers/commentController');
const postInteractionController = require('../controllers/postInteractionController');

// Community post routes
router.get('/recruiter', auth, communityController.getRecruiterPosts);
router.get('/statistics', auth, communityController.getStatistics);
router.get('/posts', communityController.getPosts);
router.post('/posts', auth, communityController.createPost);

// Comment routes
router.get('/posts/:postId/comments', commentController.getComments);
router.post('/posts/:postId/comments', auth, commentController.addComment);
router.delete('/posts/:postId/comments/:commentId', auth, commentController.deleteComment);

// Post interaction routes
router.post('/posts/:postId/like', auth, postInteractionController.likePost);
router.post('/posts/:postId/unlike', auth, postInteractionController.unlikePost);

module.exports = router;
