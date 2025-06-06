const express = require('express');
const auth = require('../middleware/auth');
const Opportunity = require('../models/Opportunity');
const User = require('../models/User');
const Application = require('../models/Application');
const router = express.Router();

// Get all opportunities with filtering and pagination
router.get('/', async (req, res) => {
  try {
    const { 
      search, 
      type, 
      skills, 
      category,
      experienceLevel,
      location,
      page = 1, 
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;
    
    let query = { isActive: true };
    
    // Add search query if provided
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Add type filter if provided
    if (type) {
      query.type = type;
    }
    
    // Add skills filter if provided
    if (skills) {
      const skillsArray = skills.split(',');
      query.skillsRequired = { $in: skillsArray };
    }

    // Add category filter if provided
    if (category) {
      query.category = category;
    }

    // Add experienceLevel filter if provided
    if (experienceLevel) {
      query.experienceLevel = experienceLevel;
    }

    // Add location filter if provided
    if (location) {
      query.location = { $regex: location, $options: 'i' };
    }
    
    // Calculate pagination values
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    // Execute query with pagination and sorting
    const opportunities = await Opportunity.find(query)
      .populate('organization', 'firstName lastName organization')
      .sort(sortOptions)
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination info
    const totalCount = await Opportunity.countDocuments(query);
    
    res.json({
      opportunities,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalCount / parseInt(limit))
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get career recommendations for a student
router.get('/recommendations', auth, async (req, res) => {
  try {
    // Ensure user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Get student profile
    const student = await User.findById(req.user.id);
    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }
    
    // Build recommendation query based on student skills and interests
    let query = { isActive: true };
    
    if (student.skills && student.skills.length > 0) {
      query.skillsRequired = { $in: student.skills };
    }
    
    if (student.careerInterests && student.careerInterests.length > 0) {
      query.category = { $in: student.careerInterests };
    }
    
    // Find opportunities that match student profile
    const recommendations = await Opportunity.find(query)
      .populate('organization', 'firstName lastName organization')
      .sort({ createdAt: -1 })
      .limit(10);
      
    res.json(recommendations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get opportunities posted by recruiter with filters
router.get('/recruiter', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    console.log('Fetching opportunities for recruiter:', req.user.id);
    
    const { status, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    
    let query = { organization: req.user.id };
    
    // Add status filter if provided
    if (status && status !== 'all') {
      query.isActive = status === 'active';
    }
    
    // Set up sort options
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    
    const opportunities = await Opportunity.find(query)
      .sort(sortOptions);

    console.log('Found opportunities:', opportunities.length);
      
    // Get application stats for each opportunity
    const opportunitiesWithStats = await Promise.all(
      opportunities.map(async (opportunity) => {
        const applications = await Application.find({ opportunity: opportunity._id });
        
        const applicationStats = {
          total: applications.length,
          pending: applications.filter(app => app.status === 'Pending').length,
          underReview: applications.filter(app => app.status === 'Under Review').length,
          shortlisted: applications.filter(app => app.status === 'Shortlisted').length,
          interview: applications.filter(app => app.status === 'Interview').length,
          accepted: applications.filter(app => app.status === 'Accepted').length,
          rejected: applications.filter(app => app.status === 'Rejected').length
        };
        
        return {
          ...opportunity.toObject(),
          id: opportunity._id.toString(),
          applicationStats
        };
      })
    );
      
    res.json(opportunitiesWithStats);
  } catch (error) {
    console.error('Error fetching recruiter opportunities:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new opportunity
router.post('/', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { 
      title, 
      description, 
      requirements, 
      location, 
      type, 
      duration, 
      stipend, 
      deadline, 
      skillsRequired,
      tags,
      category,
      experienceLevel
    } = req.body;
    
    const opportunity = new Opportunity({
      title,
      organization: req.user.id,
      description,
      requirements,
      location,
      type,
      duration,
      stipend,
      deadline,
      skillsRequired,
      tags,
      category,
      experienceLevel
    });
    
    await opportunity.save();
    
    res.status(201).json(opportunity);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get opportunity by id with application stats
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const opportunity = await Opportunity.findById(id)
      .populate('organization', 'firstName lastName organization')
      .populate({
        path: 'applications',
        select: 'status appliedDate',
        options: { sort: { appliedDate: -1 } }
      });
      
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }
    
    // Increment view count
    opportunity.views += 1;
    await opportunity.save();
    
    // Calculate application statistics
    const applicationStats = {
      total: opportunity.applications.length,
      pending: opportunity.applications.filter(app => app.status === 'Pending').length,
      underReview: opportunity.applications.filter(app => app.status === 'Under Review').length,
      shortlisted: opportunity.applications.filter(app => app.status === 'Shortlisted').length,
      interview: opportunity.applications.filter(app => app.status === 'Interview').length,
      accepted: opportunity.applications.filter(app => app.status === 'Accepted').length,
      rejected: opportunity.applications.filter(app => app.status === 'Rejected').length
    };
    
    // Return the opportunity with stats
    const opportunityWithStats = {
      ...opportunity._doc,
      applicationStats
    };
    
    res.json(opportunityWithStats);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update opportunity
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const opportunity = await Opportunity.findById(id);
    
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }
    
    // Ensure user is the creator of this opportunity
    if (opportunity.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { 
      title, 
      description, 
      requirements, 
      location, 
      type, 
      duration, 
      stipend, 
      deadline, 
      skillsRequired,
      tags,
      isActive,
      category,
      experienceLevel
    } = req.body;
    
    // Update fields if provided
    if (title) opportunity.title = title;
    if (description) opportunity.description = description;
    if (requirements) opportunity.requirements = requirements;
    if (location) opportunity.location = location;
    if (type) opportunity.type = type;
    if (duration) opportunity.duration = duration;
    if (stipend) opportunity.stipend = stipend;
    if (deadline) opportunity.deadline = deadline;
    if (skillsRequired) opportunity.skillsRequired = skillsRequired;
    if (tags) opportunity.tags = tags;
    if (category) opportunity.category = category;
    if (experienceLevel) opportunity.experienceLevel = experienceLevel;
    if (isActive !== undefined) opportunity.isActive = isActive;
    
    opportunity.updatedAt = Date.now();
    
    await opportunity.save();
    
    res.json(opportunity);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get all candidates who applied to an opportunity
router.get('/:id/candidates', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, sort = 'appliedDate', order = 'desc' } = req.query;
    
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Find the opportunity
    const opportunity = await Opportunity.findById(id);
    
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }
    
    // Ensure recruiter is the creator of this opportunity
    if (opportunity.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Build query
    let query = { opportunity: id };
    
    if (status) {
      query.status = status;
    }
    
    // Set up sort options
    const sortOptions = {};
    sortOptions[sort] = order === 'asc' ? 1 : -1;
    
    // Find applications
    const applications = await Application.find(query)
      .populate({
        path: 'student',
        select: 'firstName lastName email avatar skills education experience'
      })
      .sort(sortOptions);
      
    res.json(applications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Save an opportunity to student's saved list
router.post('/:id/save', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Ensure user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Find opportunity
    const opportunity = await Opportunity.findById(id);
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }
    
    // Find user and update saved opportunities
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Check if already saved
    if (user.savedOpportunities.includes(id)) {
      return res.status(400).json({ message: 'Opportunity already saved' });
    }
    
    user.savedOpportunities.push(id);
    await user.save();
    
    res.json({ message: 'Opportunity saved successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Remove an opportunity from student's saved list
router.delete('/:id/save', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Ensure user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Find user and update saved opportunities
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Remove from saved opportunities
    user.savedOpportunities = user.savedOpportunities.filter(
      oppId => oppId.toString() !== id
    );
    
    await user.save();
    
    res.json({ message: 'Opportunity removed from saved list' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get saved opportunities for a student
router.get('/saved/list', auth, async (req, res) => {
  try {
    // Ensure user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Find user
    const user = await User.findById(req.user.id).populate('savedOpportunities');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json(user.savedOpportunities);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
