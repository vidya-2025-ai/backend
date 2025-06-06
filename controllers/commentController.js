
const { Post } = require('../models/Community');
const User = require('../models/User');

// Get comments for a post
exports.getComments = async (req, res) => {
  try {
    const { postId } = req.params;
    
    // Find post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Format the response
    const comments = post.comments.map(comment => ({
      id: comment._id,
      content: comment.content,
      author: {
        id: comment.author,
        name: comment.authorName,
        role: comment.authorRole
      },
      createdAt: comment.createdAt
    }));
    
    res.json(comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Add a comment to a post
exports.addComment = async (req, res) => {
  try {
    const { postId } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }
    
    // Find post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Get user data
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Create comment
    const comment = {
      content,
      author: req.user.id,
      authorName: `${user.firstName} ${user.lastName}`,
      authorRole: user.role,
      createdAt: new Date()
    };
    
    // Add comment to post
    post.comments.push(comment);
    await post.save();
    
    // Get the newly added comment
    const newComment = post.comments[post.comments.length - 1];
    
    res.status(201).json({
      id: newComment._id,
      content: newComment.content,
      author: {
        id: newComment.author,
        name: newComment.authorName,
        role: newComment.authorRole
      },
      createdAt: newComment.createdAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Delete a comment from a post
exports.deleteComment = async (req, res) => {
  try {
    const { postId, commentId } = req.params;
    
    // Find post
    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }
    
    // Find comment index
    const commentIndex = post.comments.findIndex(comment => comment._id.toString() === commentId);
    if (commentIndex === -1) {
      return res.status(404).json({ message: 'Comment not found' });
    }
    
    // Check if user is author of the comment
    if (post.comments[commentIndex].author.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to delete this comment' });
    }
    
    // Remove comment
    post.comments.splice(commentIndex, 1);
    await post.save();
    
    res.json({ message: 'Comment deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
