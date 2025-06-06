
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const Event = require('../models/Event');
const User = require('../models/User');

// Create a new event
router.post('/', auth, async (req, res) => {
  try {
    console.log('Creating event:', req.body);

    const {
      title,
      date,
      time,
      type,
      description,
      location,
      duration,
      relatedTo,
      relatedType,
      status,
      meetingLink
    } = req.body;

    const event = new Event({
      title,
      date: new Date(date),
      time,
      user: req.user.id,
      type: type || 'Other',
      description,
      location,
      relatedTo,
      onModel: relatedType,
      isCompleted: status === 'Completed'
    });

    await event.save();
    console.log('Event created:', event._id);

    res.status(201).json({
      id: event._id,
      title: event.title,
      date: event.date.toISOString().split('T')[0],
      time: event.time,
      type: event.type,
      description: event.description,
      location: event.location,
      status: event.isCompleted ? 'Completed' : 'Upcoming',
      meetingLink,
      createdAt: event.createdAt
    });
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get recruiter events
router.get('/recruiter', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    console.log('Fetching events for recruiter:', req.user.id);

    const events = await Event.find({ user: req.user.id })
      .sort({ date: 1, time: 1 });

    const formattedEvents = events.map(event => ({
      id: event._id,
      _id: event._id,
      title: event.title,
      date: event.date.toISOString().split('T')[0],
      time: event.time,
      type: event.type,
      description: event.description,
      location: event.location,
      status: event.isCompleted ? 'Completed' : 'Upcoming',
      relatedTo: event.relatedTo,
      relatedType: event.onModel,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt || event.createdAt
    }));

    console.log(`Found ${formattedEvents.length} events`);
    res.json(formattedEvents);
  } catch (error) {
    console.error('Error fetching recruiter events:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get student events - only events created by the student
router.get('/student', auth, async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    console.log('Fetching events for student:', req.user.id);

    // Get events created by the student themselves
    const studentEvents = await Event.find({ user: req.user.id })
      .sort({ date: 1, time: 1 });

    const formattedEvents = studentEvents.map(event => ({
      id: event._id,
      _id: event._id,
      title: event.title,
      date: event.date.toISOString().split('T')[0],
      time: event.time,
      type: event.type,
      description: event.description,
      location: event.location,
      status: event.isCompleted ? 'Completed' : 'Upcoming',
      relatedTo: event.relatedTo,
      relatedType: event.onModel,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt || event.createdAt
    }));

    console.log(`Found ${formattedEvents.length} events for student`);
    res.json(formattedEvents);
  } catch (error) {
    console.error('Error fetching student events:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update an event
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Verify user owns the event
    if (event.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const updateData = { ...req.body };
    if (updateData.date) {
      updateData.date = new Date(updateData.date);
    }

    Object.assign(event, updateData);
    await event.save();

    res.json({
      id: event._id,
      title: event.title,
      date: event.date.toISOString().split('T')[0],
      time: event.time,
      type: event.type,
      description: event.description,
      location: event.location,
      status: event.isCompleted ? 'Completed' : 'Upcoming',
      updatedAt: event.updatedAt || Date.now()
    });
  } catch (error) {
    console.error('Error updating event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete an event
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findById(id);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    // Verify user owns the event
    if (event.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    await Event.deleteOne({ _id: id });
    res.json({ message: 'Event deleted successfully' });
  } catch (error) {
    console.error('Error deleting event:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
