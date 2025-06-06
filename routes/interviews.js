
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Application = require('../models/Application');
const Opportunity = require('../models/Opportunity');
const Event = require('../models/Event');

// Interview Schema (embedded in applications or separate collection)
const InterviewSchema = new mongoose.Schema({
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application',
    required: true
  },
  candidate: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recruiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  opportunity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Opportunity',
    required: true
  },
  date: {
    type: String,
    required: true // YYYY-MM-DD format
  },
  time: {
    type: String,
    required: true // HH:MM format
  },
  duration: {
    type: Number,
    default: 60 // minutes
  },
  type: {
    type: String,
    enum: ['Screening', 'Technical', 'HR Round', 'Final Round'],
    default: 'Technical'
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Confirmed', 'Completed', 'Cancelled', 'Rescheduled'],
    default: 'Scheduled'
  },
  location: {
    type: String,
    default: 'Video Call'
  },
  meetingLink: {
    type: String
  },
  notes: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

const Interview = mongoose.model('Interview', InterviewSchema);

// Schedule an interview
router.post('/schedule', auth, async (req, res) => {
  try {
    // Verify user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Only recruiters can schedule interviews' });
    }

    const {
      applicationId,
      candidateId,
      date,
      time,
      duration,
      type,
      location,
      meetingLink,
      notes
    } = req.body;

    console.log('Scheduling interview:', req.body);

    // Verify the application exists and belongs to recruiter's opportunity
    const application = await Application.findById(applicationId)
      .populate('opportunity')
      .populate('student');

    if (!application) {
      return res.status(404).json({ message: 'Application not found' });
    }

    if (application.opportunity.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Create interview record
    const interview = new Interview({
      application: applicationId,
      candidate: candidateId,
      recruiter: req.user.id,
      opportunity: application.opportunity._id,
      date,
      time,
      duration: duration || 60,
      type: type || 'Technical',
      location: location || 'Video Call',
      meetingLink,
      notes
    });

    await interview.save();

    // Update application status to Interview if not already
    if (application.status !== 'Interview') {
      application.status = 'Interview';
      application.interviewDate = new Date(`${date}T${time}`);
      application.activities.push({
        type: 'Interview Scheduled',
        description: `${type || 'Technical'} interview scheduled for ${date} at ${time}`
      });
      await application.save();
    }

    // Create calendar events for both recruiter and candidate
    const eventTitle = `Interview: ${application.student.firstName} ${application.student.lastName}`;
    
    // Fix: Create date object properly without timezone issues
    const eventDate = new Date(date + 'T00:00:00');
    
    // Recruiter's calendar event
    await Event.create({
      title: eventTitle,
      date: eventDate,
      time: time,
      user: req.user.id,
      type: 'Interview',
      description: `${type || 'Technical'} interview for ${application.opportunity.title}`,
      location: location,
      relatedTo: applicationId,
      onModel: 'Application'
    });

    // Candidate's calendar event
    await Event.create({
      title: `Interview: ${application.opportunity.title}`,
      date: eventDate,
      time: time,
      user: candidateId,
      type: 'Interview',
      description: `${type || 'Technical'} interview with recruiter`,
      location: location,
      relatedTo: applicationId,
      onModel: 'Application'
    });

    // Populate the response
    const populatedInterview = await Interview.findById(interview._id)
      .populate('candidate', 'firstName lastName email')
      .populate('recruiter', 'firstName lastName')
      .populate('opportunity', 'title');

    console.log('Interview scheduled successfully:', populatedInterview._id);

    res.status(201).json({
      id: populatedInterview._id,
      applicationId: populatedInterview.application,
      candidateId: populatedInterview.candidate._id,
      candidateName: `${populatedInterview.candidate.firstName} ${populatedInterview.candidate.lastName}`,
      position: populatedInterview.opportunity.title,
      recruiterId: populatedInterview.recruiter._id,
      recruiterName: `${populatedInterview.recruiter.firstName} ${populatedInterview.recruiter.lastName}`,
      date: populatedInterview.date,
      time: populatedInterview.time,
      duration: populatedInterview.duration,
      type: populatedInterview.type,
      status: populatedInterview.status,
      location: populatedInterview.location,
      meetingLink: populatedInterview.meetingLink,
      notes: populatedInterview.notes,
      createdAt: populatedInterview.createdAt,
      updatedAt: populatedInterview.updatedAt
    });
  } catch (error) {
    console.error('Error scheduling interview:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get recruiter's interviews
router.get('/recruiter', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    console.log('Fetching interviews for recruiter:', req.user.id);

    const interviews = await Interview.find({ recruiter: req.user.id })
      .populate('candidate', 'firstName lastName email')
      .populate('opportunity', 'title')
      .sort({ date: 1, time: 1 });

    const formattedInterviews = interviews.map(interview => ({
      id: interview._id,
      applicationId: interview.application,
      candidateId: interview.candidate._id,
      candidateName: `${interview.candidate.firstName} ${interview.candidate.lastName}`,
      position: interview.opportunity.title,
      recruiterId: interview.recruiter,
      recruiterName: '', // Recruiter is the current user
      date: interview.date,
      time: interview.time,
      duration: interview.duration,
      type: interview.type,
      status: interview.status,
      location: interview.location,
      meetingLink: interview.meetingLink,
      notes: interview.notes,
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt
    }));

    console.log(`Found ${formattedInterviews.length} interviews`);
    res.json(formattedInterviews);
  } catch (error) {
    console.error('Error fetching recruiter interviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student's interviews
router.get('/student', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    console.log('Fetching interviews for student:', req.user.id);

    const interviews = await Interview.find({ candidate: req.user.id })
      .populate('recruiter', 'firstName lastName')
      .populate('opportunity', 'title')
      .sort({ date: 1, time: 1 });

    const formattedInterviews = interviews.map(interview => ({
      id: interview._id,
      applicationId: interview.application,
      candidateId: interview.candidate,
      candidateName: '', // Current user is the candidate
      position: interview.opportunity.title,
      recruiterId: interview.recruiter._id,
      recruiterName: `${interview.recruiter.firstName} ${interview.recruiter.lastName}`,
      date: interview.date,
      time: interview.time,
      duration: interview.duration,
      type: interview.type,
      status: interview.status,
      location: interview.location,
      meetingLink: interview.meetingLink,
      notes: interview.notes,
      createdAt: interview.createdAt,
      updatedAt: interview.updatedAt
    }));

    console.log(`Found ${formattedInterviews.length} interviews`);
    res.json(formattedInterviews);
  } catch (error) {
    console.error('Error fetching student interviews:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update interview status
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Verify user has permission to update
    if (req.user.id !== interview.recruiter.toString() && req.user.id !== interview.candidate.toString()) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    interview.status = status;
    interview.updatedAt = Date.now();
    await interview.save();

    res.json({ message: 'Interview status updated', interview });
  } catch (error) {
    console.error('Error updating interview status:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Reschedule interview
router.put('/:id/reschedule', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const { date, time } = req.body;

    const interview = await Interview.findById(id);
    if (!interview) {
      return res.status(404).json({ message: 'Interview not found' });
    }

    // Only recruiter can reschedule
    if (req.user.id !== interview.recruiter.toString()) {
      return res.status(403).json({ message: 'Only recruiters can reschedule interviews' });
    }

    interview.date = date;
    interview.time = time;
    interview.status = 'Rescheduled';
    interview.updatedAt = Date.now();
    await interview.save();

    // Update related calendar events with proper date handling
    const eventDate = new Date(date + 'T00:00:00');
    await Event.updateMany(
      { relatedTo: interview.application, type: 'Interview' },
      { 
        date: eventDate,
        time: time
      }
    );

    res.json({ message: 'Interview rescheduled', interview });
  } catch (error) {
    console.error('Error rescheduling interview:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
