
const jwt = require('jsonwebtoken');

module.exports = function(req, res, next) {
  // Get token from header
  const token = req.header('x-auth-token');
  
  // Check if no token
  if (!token) {
    console.log('No authentication token provided');
    return res.status(401).json({ message: 'No token, authorization denied' });
  }
  
  // Verify token
  try {
    // Make sure to use the same secret as in the auth routes for token generation
    const jwtSecret = process.env.JWT_SECRET || 'defaultsecret';
    const decoded = jwt.verify(token, jwtSecret);
    
    req.user = decoded;
    console.log('Token validated for user ID:', decoded.id);
    next();
  } catch (error) {
    console.error('JWT Verification error:', error.message);
    
    // Clear invalid tokens from client
    res.setHeader('Clear-Site-Data', '"storage"');
    res.status(401).json({ message: 'Token is not valid' });
  }
};
