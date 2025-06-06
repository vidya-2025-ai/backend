
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Grievance = require('../models/Grievance');
const User = require('../models/User');

// Get all grievances for recruiter
router.get('/recruiter', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { status, page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;
    
    // Build query
    let query = {};
    
    // Filter by status if provided
    if (status) {
      query.status = status;
    }
    
    // Search in title or description if provided
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Get grievances with pagination
    const grievances = await Grievance.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    // Get total count for pagination
    const totalCount = await Grievance.countDocuments(query);
    
    // Format grievances
    const formattedGrievances = grievances.map(grievance => ({
      id: grievance._id,
      title: grievance.title,
      description: grievance.description,
      status: grievance.status,
      creatorName: grievance.creatorName,
      creatorRole: grievance.creatorRole,
      responseCount: grievance.responses.length,
      createdAt: grievance.createdAt
    }));
    
    res.json({
      grievances: formattedGrievances,
      pagination: {
        totalCount,
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get grievance details
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const grievance = await Grievance.findById(id);
    if (!grievance) {
      return res.status(404).json({ message: 'Grievance not found' });
    }
    
    res.json({
      id: grievance._id,
      title: grievance.title,
      description: grievance.description,
      status: grievance.status,
      creator: {
        id: grievance.createdBy,
        name: grievance.creatorName,
        role: grievance.creatorRole
      },
      responses: grievance.responses.map(response => ({
        id: response._id,
        content: response.content,
        responder: {
          id: response.responder,
          name: response.responderName,
          role: response.responderRole
        },
        createdAt: response.createdAt
      })),
      createdAt: grievance.createdAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add response to grievance
router.put('/:id/response', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: 'Response content is required' });
    }
    
    // Find grievance
    const grievance = await Grievance.findById(id);
    if (!grievance) {
      return res.status(404).json({ message: 'Grievance not found' });
    }
    
    // Get user
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    // Create response
    const response = {
      content,
      responder: req.user.id,
      responderName: `${user.firstName} ${user.lastName}`,
      responderRole: user.role,
      createdAt: new Date()
    };
    
    // Add response to grievance
    grievance.responses.push(response);
    
    // Update status to 'resolved' if it was 'pending'
    if (grievance.status === 'pending' && user.role === 'recruiter') {
      grievance.status = 'resolved';
    }
    
    await grievance.save();
    
    res.json({
      id: grievance._id,
      status: grievance.status,
      response: {
        id: grievance.responses[grievance.responses.length - 1]._id,
        content: response.content,
        responder: {
          id: response.responder,
          name: response.responderName,
          role: response.responderRole
        },
        createdAt: response.createdAt
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Close grievance (change status to closed)
router.put('/:id/close', auth, async (req, res) => {
  try {
    // Only recruiters can close grievances
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { id } = req.params;
    
    // Find grievance
    const grievance = await Grievance.findById(id);
    if (!grievance) {
      return res.status(404).json({ message: 'Grievance not found' });
    }
    
    // Update status
    grievance.status = 'closed';
    await grievance.save();
    
    res.json({
      id: grievance._id,
      status: grievance.status
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reopen grievance (change status to pending)
router.put('/:id/reopen', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find grievance
    const grievance = await Grievance.findById(id);
    if (!grievance) {
      return res.status(404).json({ message: 'Grievance not found' });
    }
    
    // Ensure only the creator or a recruiter can reopen
    if (
      grievance.createdBy.toString() !== req.user.id && 
      req.user.role !== 'recruiter'
    ) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Update status
    grievance.status = 'pending';
    await grievance.save();
    
    res.json({
      id: grievance._id,
      status: grievance.status
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get grievance statistics for recruiter dashboard
router.get('/statistics', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Get all grievances
    const grievances = await Grievance.find();
    
    // Calculate statistics
    const totalGrievances = grievances.length;
    const pendingGrievances = grievances.filter(g => g.status === 'pending').length;
    const resolvedGrievances = grievances.filter(g => g.status === 'resolved').length;
    const closedGrievances = grievances.filter(g => g.status === 'closed').length;
    
    // Response time statistics (in hours)
    const responseTimes = grievances
      .filter(g => g.responses.length > 0)
      .map(g => {
        const firstResponse = g.responses[0];
        const created = new Date(g.createdAt).getTime();
        const responded = new Date(firstResponse.createdAt).getTime();
        return (responded - created) / (1000 * 60 * 60); // hours
      });
    
    const averageResponseTime = responseTimes.length > 0
      ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length
      : 0;
    
    const minResponseTime = responseTimes.length > 0
      ? Math.min(...responseTimes)
      : 0;
    
    const maxResponseTime = responseTimes.length > 0
      ? Math.max(...responseTimes)
      : 0;
    
    res.json({
      totalGrievances,
      pendingGrievances,
      resolvedGrievances,
      closedGrievances,
      responseTime: {
        average: parseFloat(averageResponseTime.toFixed(2)),
        min: parseFloat(minResponseTime.toFixed(2)),
        max: parseFloat(maxResponseTime.toFixed(2))
      },
      categoryCounts: [] // Would need to add category field to Grievance model
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
