
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Mentorship = require('../models/Mentorship');

// Get available mentors with filtering and pagination
router.get('/mentors', auth, async (req, res) => {
  try {
    const { skills, organization, experience, page = 1, limit = 10 } = req.query;
    
    // Build query
    const query = { role: 'recruiter' };
    
    // Filter by skills
    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim());
      query.skills = { $in: skillsArray };
    }
    
    // Filter by organization
    if (organization) {
      query.organization = new RegExp(organization, 'i');
    }
    
    // Filter by experience
    if (experience) {
      if (experience === 'senior') {
        query.yearsOfExperience = { $gte: 5 };
      } else if (experience === 'mid') {
        query.yearsOfExperience = { $gte: 3, $lt: 5 };
      } else if (experience === 'junior') {
        query.yearsOfExperience = { $lt: 3 };
      }
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Find mentors
    const mentors = await User.find(query)
      .select('-password')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ lastActive: -1 });
    
    // Count total for pagination
    const total = await User.countDocuments(query);
    
    res.json({
      mentors,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all mentorship requests for a user
router.get('/', auth, async (req, res) => {
  try {
    // Get all mentorships where user is either mentor or student
    const mentorships = await Mentorship.find({
      $or: [
        { mentor: req.user.id },
        { student: req.user.id }
      ]
    })
    .populate('mentor', 'firstName lastName organization jobTitle avatar')
    .populate('student', 'firstName lastName avatar')
    .sort({ createdAt: -1 });
    
    res.json({
      mentorships,
      pagination: {
        total: mentorships.length,
        page: 1,
        limit: mentorships.length,
        totalPages: 1
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user's mentorship requests with filtering and pagination
router.get('/my', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    
    // If student, get mentorships where user is student
    // If recruiter, get mentorships where user is mentor
    const query = req.user.role === 'student' 
      ? { student: req.user.id }
      : { mentor: req.user.id };
    
    // Filter by status if specified
    if (status && ['pending', 'accepted', 'rejected'].includes(status)) {
      query.status = status;
    }
    
    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Get mentorships
    const mentorships = await Mentorship.find(query)
      .populate('mentor', 'firstName lastName organization jobTitle avatar')
      .populate('student', 'firstName lastName avatar skills')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    // Get total count
    const total = await Mentorship.countDocuments(query);
    
    res.json({
      mentorships,
      data: mentorships,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create mentorship request
router.post('/request', auth, async (req, res) => {
  try {
    // Ensure user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can request mentorship' });
    }
    
    const { mentorId, message, topic } = req.body;
    
    if (!mentorId || !message) {
      return res.status(400).json({ message: 'Mentor ID and message are required' });
    }
    
    // Check if mentor exists and is a recruiter
    const mentor = await User.findById(mentorId);
    if (!mentor || mentor.role !== 'recruiter') {
      return res.status(404).json({ message: 'Invalid mentor' });
    }
    
    // Check if mentorship request already exists
    const existingRequest = await Mentorship.findOne({
      mentor: mentorId,
      student: req.user.id,
      status: { $in: ['pending', 'accepted'] }
    });
    
    if (existingRequest) {
      return res.status(400).json({ message: 'Mentorship request already exists' });
    }
    
    // Create mentorship request
    const mentorship = new Mentorship({
      mentor: mentorId,
      student: req.user.id,
      message,
      topic: topic || 'General Mentorship'
    });
    
    await mentorship.save();
    
    // Populate mentor and student data
    await mentorship.populate('mentor', 'firstName lastName organization jobTitle avatar');
    await mentorship.populate('student', 'firstName lastName avatar');
    
    res.status(201).json(mentorship);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update mentorship status
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    if (!status || !['accepted', 'rejected'].includes(status)) {
      return res.status(400).json({ message: 'Valid status is required' });
    }
    
    // Find mentorship request
    const mentorship = await Mentorship.findById(id);
    if (!mentorship) {
      return res.status(404).json({ message: 'Mentorship request not found' });
    }
    
    // Ensure user is the mentor of this request
    if (mentorship.mentor.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Update status
    mentorship.status = status;
    mentorship.updatedAt = Date.now();
    await mentorship.save();
    
    // Populate mentor and student data
    await mentorship.populate('mentor', 'firstName lastName organization jobTitle avatar');
    await mentorship.populate('student', 'firstName lastName avatar');
    
    res.json(mentorship);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create mentorship program (for mentors)
router.post('/programs', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Only recruiters can create mentorship programs' });
    }
    
    const { title, description, duration, skillsOffered, maxParticipants, requirements } = req.body;
    
    if (!title || !description || !duration) {
      return res.status(400).json({ message: 'Title, description, and duration are required' });
    }
    
    // Create a special mentorship entry for programs
    const program = new Mentorship({
      mentor: req.user.id,
      student: null, // No specific student for programs
      message: description,
      topic: title,
      status: 'accepted', // Programs are automatically active
      programDetails: {
        duration,
        skillsOffered: skillsOffered || [],
        maxParticipants: maxParticipants || 10,
        requirements: requirements || [],
        currentParticipants: 0,
        isProgram: true
      }
    });
    
    await program.save();
    await program.populate('mentor', 'firstName lastName organization jobTitle avatar');
    
    res.status(201).json(program);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get available mentorship programs
router.get('/programs', auth, async (req, res) => {
  try {
    const { skills, page = 1, limit = 10 } = req.query;
    
    // Build query for programs
    const query = {
      'programDetails.isProgram': true,
      status: 'accepted'
    };
    
    // Filter by skills if provided
    if (skills) {
      const skillsArray = skills.split(',').map(s => s.trim());
      query['programDetails.skillsOffered'] = { $in: skillsArray };
    }
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const programs = await Mentorship.find(query)
      .populate('mentor', 'firstName lastName organization jobTitle avatar')
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 });
    
    const total = await Mentorship.countDocuments(query);
    
    res.json({
      programs,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Apply to mentorship program
router.post('/programs/:programId/apply', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can apply to programs' });
    }
    
    const { programId } = req.params;
    const { message } = req.body;
    
    // Find the program
    const program = await Mentorship.findById(programId);
    if (!program || !program.programDetails?.isProgram) {
      return res.status(404).json({ message: 'Program not found' });
    }
    
    // Check if student already applied
    const existingApplication = await Mentorship.findOne({
      mentor: program.mentor,
      student: req.user.id,
      'applicationDetails.programId': programId
    });
    
    if (existingApplication) {
      return res.status(400).json({ message: 'You have already applied to this program' });
    }
    
    // Create application
    const application = new Mentorship({
      mentor: program.mentor,
      student: req.user.id,
      message: message || 'Application to mentorship program',
      topic: `Application for: ${program.topic}`,
      status: 'pending',
      applicationDetails: {
        programId: programId,
        appliedAt: new Date()
      }
    });
    
    await application.save();
    await application.populate('mentor', 'firstName lastName organization jobTitle avatar');
    await application.populate('student', 'firstName lastName avatar');
    
    res.status(201).json(application);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get mentorship statistics for recruiter
router.get('/statistics', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Get mentorship requests count by status
    const totalRequests = await Mentorship.countDocuments({ mentor: req.user.id });
    const pendingRequests = await Mentorship.countDocuments({ mentor: req.user.id, status: 'pending' });
    const acceptedRequests = await Mentorship.countDocuments({ mentor: req.user.id, status: 'accepted' });
    const rejectedRequests = await Mentorship.countDocuments({ mentor: req.user.id, status: 'rejected' });
    
    // Get active mentees
    const activeMentees = await Mentorship.countDocuments({ 
      mentor: req.user.id,
      status: 'accepted'
    });
    
    // Get active programs count
    const activePrograms = await Mentorship.countDocuments({
      mentor: req.user.id,
      'programDetails.isProgram': true
    });
    
    // Get recent mentorship requests
    const recentRequests = await Mentorship.find({ mentor: req.user.id })
      .populate('student', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .limit(5);
    
    res.json({
      totalRequests,
      pendingRequests,
      acceptedRequests,
      rejectedRequests,
      activeMentees,
      activePrograms,
      recentRequests,
      topMentors: []
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recent mentorship requests
router.get('/recent', auth, async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    
    const query = req.user.role === 'student' 
      ? { student: req.user.id }
      : { mentor: req.user.id };
    
    const recentRequests = await Mentorship.find(query)
      .populate('mentor', 'firstName lastName organization jobTitle avatar')
      .populate('student', 'firstName lastName avatar')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));
    
    res.json(recentRequests);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
