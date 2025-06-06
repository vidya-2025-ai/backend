
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// Register user
router.post('/register', async (req, res) => {
  try {
    const { 
      firstName, 
      lastName, 
      email, 
      password, 
      role, 
      organization,
      jobTitle 
    } = req.body;
    
    console.log('Register request received:', req.body);
    
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }
    
    // Create user object based on role
    const userData = {
      firstName,
      lastName,
      email,
      password,
      role
    };
    
    // Add role-specific fields
    if (role === 'recruiter') {
      userData.organization = organization;
      userData.jobTitle = jobTitle;
    }
    
    console.log('Creating new user with data:', userData);
    
    // Create new user
    const user = new User(userData);
    
    await user.save();
    console.log('User saved successfully:', user._id);
    
    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'defaultsecret';
    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      jwtSecret,
      { expiresIn: '30d' }
    );
    
    console.log('JWT token generated for new user');
    
    // Prepare response data removing sensitive information
    const responseUser = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    };
    
    // Add role-specific fields to response
    if (user.role === 'recruiter') {
      responseUser.organization = user.organization;
      responseUser.jobTitle = user.jobTitle;
    }
    
    res.status(201).json({
      token,
      user: responseUser
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
});

// Login user
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    console.log('Login attempt for email:', email);
    
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found with email:', email);
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    // Check if password is correct
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('Password mismatch for user:', email);
      return res.status(400).json({ message: 'Invalid email or password' });
    }
    
    console.log('Login successful for user:', user._id);
    
    // Generate JWT token
    const jwtSecret = process.env.JWT_SECRET || 'defaultsecret';
    const token = jwt.sign(
      { id: user._id, role: user.role }, 
      jwtSecret,
      { expiresIn: '30d' }
    );
    
    console.log('JWT token generated for login');
    
    // Update lastActive
    user.lastActive = Date.now();
    await user.save();
    
    // Prepare response data removing sensitive information
    const responseUser = {
      id: user._id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role
    };
    
    // Add role-specific fields to response
    if (user.role === 'recruiter') {
      responseUser.organization = user.organization;
      responseUser.jobTitle = user.jobTitle;
    }
    
    res.json({
      token,
      user: responseUser
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
});

// Logout user
router.post('/logout', async (req, res) => {
  // This endpoint is primarily for client-side token clearing
  // But we can add server-side logging if needed
  console.log('User logged out');
  res.json({ message: 'Logout successful' });
});

// Verify token route for checking authentication
router.get('/verify', async (req, res) => {
  try {
    const token = req.header('x-auth-token');
    
    if (!token) {
      console.log('Verify endpoint called without token');
      return res.status(401).json({ valid: false, message: 'No token provided' });
    }
    
    const jwtSecret = process.env.JWT_SECRET || 'defaultsecret';
    const decoded = jwt.verify(token, jwtSecret);
    
    console.log('Token verification attempt for user ID:', decoded.id);
    
    // Check if user still exists in database
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      console.log('User not found during token verification');
      return res.status(401).json({ valid: false, message: 'User not found' });
    }
    
    console.log('Token verified successfully for user:', user._id);
    
    return res.json({ 
      valid: true, 
      user: { 
        id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        ...(user.role === 'recruiter' ? { 
          organization: user.organization,
          jobTitle: user.jobTitle 
        } : {})
      }
    });
  } catch (error) {
    console.error('Token verification error:', error);
    return res.status(401).json({ valid: false, message: 'Invalid token' });
  }
});

module.exports = router;
