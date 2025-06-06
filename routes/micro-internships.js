
const express = require('express');
const auth = require('../middleware/auth');
const MicroInternship = require('../models/MicroInternship');
const MicroInternshipApplication = require('../models/MicroInternshipApplication');
const User = require('../models/User');
const router = express.Router();

// Get all micro-internships
router.get('/', async (req, res) => {
  try {
    const microInternships = await MicroInternship.find({ isActive: true })
      .sort({ createdAt: -1 });
      
    // Format the response to match the expected structure
    const formattedInternships = microInternships.map(internship => ({
      id: internship._id,
      title: internship.title,
      description: internship.description,
      organization: internship.organizationName,
      duration: internship.duration,
      skillsRequired: internship.skillsRequired,
      stipend: internship.stipend,
      deadline: internship.deadline,
      applicants: internship.applications.length,
      createdAt: internship.createdAt
    }));

    res.json(formattedInternships);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new micro-internship (recruiters only)
router.post('/', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { 
      title, 
      description, 
      duration,
      skillsRequired,
      stipendAmount,
      stipendCurrency,
      deadline
    } = req.body;
    
    if (!title || !description || !duration) {
      return res.status(400).json({ message: 'Title, description, and duration are required' });
    }
    
    // Get user details to store organization name
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Create micro-internship
    const microInternship = new MicroInternship({
      title,
      description,
      organization: req.user.id,
      organizationName: user.organization || user.firstName + ' ' + user.lastName,
      duration,
      skillsRequired: skillsRequired || [],
      stipend: {
        amount: stipendAmount || 0,
        currency: stipendCurrency || 'INR'
      },
      deadline: deadline || new Date(Date.now() + 604800000), // Default to 1 week from now
      applications: []
    });
    
    await microInternship.save();
    
    res.status(201).json({
      id: microInternship._id,
      title: microInternship.title,
      description: microInternship.description,
      organization: microInternship.organizationName,
      duration: microInternship.duration,
      skillsRequired: microInternship.skillsRequired,
      stipend: microInternship.stipend,
      deadline: microInternship.deadline,
      applicants: 0,
      createdAt: microInternship.createdAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Apply to a micro-internship
router.post('/:internshipId/apply', auth, async (req, res) => {
  try {
    // Ensure user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can apply for micro-internships' });
    }
    
    const { internshipId } = req.params;
    const { coverLetter, resume } = req.body;
    
    // Find the internship
    const internship = await MicroInternship.findById(internshipId);
    if (!internship) {
      return res.status(404).json({ message: 'Micro-internship not found' });
    }
    
    // Check if already applied
    const existingApplication = await MicroInternshipApplication.findOne({
      internship: internshipId,
      student: req.user.id
    });
    
    if (existingApplication) {
      return res.status(400).json({ message: 'You have already applied for this micro-internship' });
    }
    
    // Get user details
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Create application
    const application = new MicroInternshipApplication({
      internship: internshipId,
      student: req.user.id,
      studentName: `${user.firstName} ${user.lastName}`,
      coverLetter,
      resume
    });
    
    await application.save();
    
    // Update internship with application reference
    internship.applications.push(application._id);
    await internship.save();
    
    res.status(201).json({
      id: application._id,
      internshipId,
      student: {
        id: req.user.id,
        name: `${user.firstName} ${user.lastName}`
      },
      status: application.status,
      appliedAt: application.appliedAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all applications for a specific micro-internship (recruiters only)
router.get('/:internshipId/applications', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { internshipId } = req.params;
    
    // Find the internship to check ownership
    const internship = await MicroInternship.findById(internshipId);
    if (!internship) {
      return res.status(404).json({ message: 'Micro-internship not found' });
    }
    
    // Ensure the recruiter is the owner of the internship
    if (internship.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Get all applications for this internship
    const applications = await MicroInternshipApplication.find({ internship: internshipId });
    
    res.json(applications.map(app => ({
      id: app._id,
      student: {
        id: app.student,
        name: app.studentName
      },
      status: app.status,
      appliedAt: app.appliedAt,
      coverLetter: app.coverLetter,
      resume: app.resume
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update application status (recruiters only)
router.put('/applications/:applicationId/status', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { applicationId } = req.params;
    const { status } = req.body;
    
    if (!status || !['accepted', 'rejected', 'shortlisted'].includes(status)) {
      return res.status(400).json({ message: 'Valid status is required' });
    }
    
    // Find the application
    const application = await MicroInternshipApplication.findById(applicationId);
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }
    
    // Find the internship to check ownership
    const internship = await MicroInternship.findById(application.internship);
    if (!internship) {
      return res.status(404).json({ message: 'Micro-internship not found' });
    }
    
    // Ensure the recruiter is the owner of the internship
    if (internship.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Update status
    application.status = status;
    await application.save();
    
    res.json({
      id: applicationId,
      status,
      updatedAt: new Date()
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
