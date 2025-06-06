const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middleware/auth');
const Application = require('../models/Application');
const Opportunity = require('../models/Opportunity');
const User = require('../models/User');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = 'uploads/resumes';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, req.user.id + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  // Accept only PDF, DOC, and DOCX files
  const allowedTypes = /pdf|doc|docx/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype) || 
    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.mimetype === 'application/msword';

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
  }
};

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: fileFilter
});

// Get all applications for current student
router.get('/student', auth, async (req, res) => {
  try {
    // Check if user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { page = 1, limit = 10, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build the query
    let query = { student: req.user.id };
    if (status && status !== 'all') {
      query.status = status;
    }

    const applications = await Application.find(query)
      .populate({
        path: 'opportunity',
        populate: {
          path: 'organization',
          select: 'firstName lastName organization'
        }
      })
      .sort({ appliedDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalCount = await Application.countDocuments(query);

    res.json(applications);
  } catch (error) {
    console.error('Error fetching student applications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all applications for recruiter across all opportunities
router.get('/recruiter', auth, async (req, res) => {
  try {
    console.log('Fetching applications for recruiter:', req.user.id);

    // Check if user is a recruiter
    if (req.user.role !== 'recruiter') {
      console.log('User is not a recruiter:', req.user.role);
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { page = 1, limit = 20, status, search, sortBy = 'appliedDate', sortOrder = 'desc' } = req.query;
    
    // First get all opportunities by this recruiter
    const opportunities = await Opportunity.find({ 
      organization: req.user.id
    }).select('_id title');
    
    console.log('Found opportunities for recruiter:', opportunities.length);
    
    if (opportunities.length === 0) {
      console.log('No opportunities found for recruiter, returning empty array');
      return res.json([]);
    }
    
    const opportunityIds = opportunities.map(opp => opp._id);
    
    // Build query for applications
    let query = { opportunity: { $in: opportunityIds } };
    if (status && status !== '' && status !== 'all') {
      query.status = status;
    }
    
    console.log('Application query:', JSON.stringify(query));
    
    // Handle search
    if (search && search.trim() !== '') {
      const students = await User.find({
        role: 'student',
        $or: [
          { firstName: { $regex: search.trim(), $options: 'i' } },
          { lastName: { $regex: search.trim(), $options: 'i' } },
          { email: { $regex: search.trim(), $options: 'i' } }
        ]
      }).select('_id');
      
      const studentIds = students.map(student => student._id);
      if (studentIds.length > 0) {
        query.student = { $in: studentIds };
      } else {
        console.log('No students found matching search term');
        return res.json([]);
      }
    }
    
    // Set up pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Set up sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    const applications = await Application.find(query)
      .populate({
        path: 'student',
        select: 'firstName lastName email avatar skills education experience'
      })
      .populate({
        path: 'opportunity',
        select: 'title type organization category experienceLevel location duration stipend',
        populate: {
          path: 'organization',
          select: 'firstName lastName organization'
        }
      })
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    console.log('Found applications:', applications.length);
    
    // Transform applications to ensure proper ID fields
    const transformedApplications = applications.map(app => ({
      ...app,
      id: app._id.toString(),
      student: app.student ? {
        ...app.student,
        id: app.student._id?.toString()
      } : null,
      opportunity: app.opportunity ? {
        ...app.opportunity,
        id: app.opportunity._id?.toString()
      } : null
    }));
      
    console.log('Sending applications response:', transformedApplications.length);

    // Return applications directly as array
    res.json(transformedApplications);
  } catch (error) {
    console.error('Error fetching recruiter applications:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get applications for a specific opportunity with filtering (for recruiters)
router.get('/opportunity/:opportunityId', auth, async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { status, page = 1, limit = 10, sortBy = 'appliedDate', sortOrder = 'desc' } = req.query;

    console.log('Fetching applications for opportunity:', opportunityId);

    // Check if user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Check if the opportunity belongs to the recruiter
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    if (opportunity.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Build the query
    let query = { opportunity: opportunityId };
    if (status) {
      query.status = status;
    }

    // Set up pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Set up sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const applications = await Application.find(query)
      .populate('student', 'firstName lastName email avatar skills')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));

    console.log('Found applications for opportunity:', applications.length);

    // Get total count for pagination
    const totalCount = await Application.countDocuments(query);

    res.json(applications);
  } catch (error) {
    console.error('Error fetching opportunity applications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Apply to an opportunity
router.post('/opportunity/:opportunityId', auth, async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { coverLetter, resumeUrl } = req.body;

    console.log('Creating application for opportunity:', opportunityId);

    // Check if user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can apply to opportunities' });
    }

    // Check if opportunity exists
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    // Check if already applied
    const existingApplication = await Application.findOne({
      student: req.user.id,
      opportunity: opportunityId
    });

    if (existingApplication) {
      return res.status(400).json({ message: 'You have already applied to this opportunity' });
    }

    // Get student skills to calculate skill match
    const student = await User.findById(req.user.id);
    let skillMatch = 0;
    
    if (student.skills && student.skills.length > 0 && opportunity.skillsRequired && opportunity.skillsRequired.length > 0) {
      const matchingSkills = student.skills.filter(skill => 
        opportunity.skillsRequired.includes(skill)
      );
      
      skillMatch = Math.round((matchingSkills.length / opportunity.skillsRequired.length) * 100);
    }

    // Create new application
    const application = new Application({
      student: req.user.id,
      opportunity: opportunityId,
      coverLetter,
      resumeUrl,
      status: 'Pending',
      skillMatch,
      activities: [{
        type: 'Application Submitted',
        description: 'Application was submitted by the student'
      }]
    });

    await application.save();
    console.log('Application created:', application._id);

    // Add the application to the opportunity's applications array if it exists
    if (opportunity.applications) {
      opportunity.applications.push(application._id);
    }
    if (opportunity.applicationCount !== undefined) {
      opportunity.applicationCount += 1;
    }
    await opportunity.save();

    res.status(201).json(application);
  } catch (error) {
    console.error('Error creating application:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update application status (for recruiters)
router.put('/:applicationId/status', auth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { status } = req.body;

    console.log(`Updating application ${applicationId} status to ${status} by user ${req.user.id}`);

    // Check if user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Validate status
    const validStatuses = ['Pending', 'Under Review', 'Shortlisted', 'Interview', 'Accepted', 'Rejected'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    // Find the application
    const application = await Application.findById(applicationId)
      .populate('opportunity')
      .populate('student', 'firstName lastName email');
    
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if the opportunity belongs to the recruiter
    if (application.opportunity.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Update status and add activity
    const oldStatus = application.status;
    application.status = status;
    application.lastUpdated = Date.now();
    application.activities.push({
      type: 'Status Update',
      description: `Application status changed from ${oldStatus} to ${status}`
    });

    await application.save();

    console.log(`Application ${applicationId} status updated successfully`);

    // Return the updated application with populated fields
    const updatedApplication = await Application.findById(applicationId)
      .populate('student', 'firstName lastName email avatar')
      .populate('opportunity', 'title type');

    res.json(updatedApplication);
  } catch (error) {
    console.error('Error updating application status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Schedule an interview for an application
router.put('/:applicationId/interview', auth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { interviewDate } = req.body;

    // Check if user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Find the application
    const application = await Application.findById(applicationId).populate('opportunity');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if the opportunity belongs to the recruiter
    if (application.opportunity.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Update interview date and status
    application.interviewDate = new Date(interviewDate);
    application.status = 'Interview';
    application.lastUpdated = Date.now();
    application.activities.push({
      type: 'Interview Scheduled',
      description: `Interview scheduled for ${new Date(interviewDate).toLocaleDateString()}`
    });

    await application.save();

    res.json(application);
  } catch (error) {
    console.error('Error scheduling interview:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a note to an application (for recruiters)
router.post('/:applicationId/notes', auth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { note } = req.body;

    // Check if user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Find the application
    const application = await Application.findById(applicationId).populate('opportunity');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if the opportunity belongs to the recruiter
    if (application.opportunity.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    application.notes = note;
    application.lastUpdated = Date.now();
    application.activities.push({
      type: 'Note Added',
      description: 'Recruiter added a note to the application'
    });

    await application.save();

    res.json(application);
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add feedback to an application
router.post('/:applicationId/feedback', auth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { feedback, rating } = req.body;

    // Check if user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Find the application
    const application = await Application.findById(applicationId).populate('opportunity');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if the opportunity belongs to the recruiter
    if (application.opportunity.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Update feedback
    if (feedback) application.feedback = feedback;
    if (rating) application.rating = rating;
    
    application.lastUpdated = Date.now();
    application.activities.push({
      type: 'Feedback Added',
      description: 'Recruiter added feedback to the application'
    });

    await application.save();

    res.json(application);
  } catch (error) {
    console.error('Error adding feedback:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a comprehensive review to an application
router.post('/:applicationId/review', auth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { strengths, weaknesses, overallAssessment, recommendationLevel } = req.body;

    // Check if user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Find the application
    const application = await Application.findById(applicationId).populate('opportunity');
    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check if the opportunity belongs to the recruiter
    if (application.opportunity.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Update review information
    application.review = {
      strengths: strengths || [],
      weaknesses: weaknesses || [],
      overallAssessment: overallAssessment || '',
      recommendationLevel: recommendationLevel || 'Neutral',
      reviewDate: Date.now()
    };
    
    application.lastUpdated = Date.now();
    application.activities.push({
      type: 'Review Added',
      description: 'Recruiter added a comprehensive review'
    });

    await application.save();

    res.json(application);
  } catch (error) {
    console.error('Error adding review:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single application with detail
router.get('/:applicationId', auth, async (req, res) => {
  try {
    const { applicationId } = req.params;

    const application = await Application.findById(applicationId)
      .populate('student', 'firstName lastName email avatar skills education experience')
      .populate('opportunity');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    // Check authorization - either the student who applied or the recruiter who posted the opportunity
    if (
      req.user.id !== application.student._id.toString() && 
      req.user.id !== application.opportunity.organization.toString()
    ) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    res.json(application);
  } catch (error) {
    console.error('Error fetching application details:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// File upload endpoint for resumes
router.post('/upload-resume', auth, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Return the file URL
    const resumeUrl = `/uploads/resumes/${req.file.filename}`;
    
    console.log('Resume uploaded successfully:', resumeUrl);
    res.json({ resumeUrl });
  } catch (error) {
    console.error('Error uploading resume:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Serve uploaded files
router.get('/uploads/resumes/:filename', (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, '../../uploads/resumes', filename);
  
  if (fs.existsSync(filepath)) {
    res.sendFile(path.resolve(filepath));
  } else {
    res.status(404).json({ message: 'File not found' });
  }
});

module.exports = router;
