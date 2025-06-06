
const express = require('express');
const auth = require('../middleware/auth');
const Event = require('../models/Event');
const router = express.Router();

// Get all events for a user
router.get('/', auth, async (req, res) => {
  try {
    const events = await Event.find({ user: req.user.id })
      .sort({ date: 1 });
      
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recruiter-specific events
router.get('/recruiter', auth, async (req, res) => {
  try {
    // Verify user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { type, startDate, endDate } = req.query;
    const query = { user: req.user.id };

    // Apply filters if provided
    if (type) query.type = type;
    if (startDate && endDate) {
      query.date = { 
        $gte: new Date(startDate), 
        $lte: new Date(endDate) 
      };
    } else if (startDate) {
      query.date = { $gte: new Date(startDate) };
    } else if (endDate) {
      query.date = { $lte: new Date(endDate) };
    }

    const events = await Event.find(query).sort({ date: 1 });
    
    res.json(events);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get statistics for recruiter events
router.get('/recruiter/statistics', auth, async (req, res) => {
  try {
    // Verify user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const now = new Date();
    const events = await Event.find({ 
      user: req.user.id 
    });
    
    // Calculate statistics
    const totalEvents = events.length;
    const upcomingEvents = events.filter(event => new Date(event.date) >= now).length;
    
    // Calculate events by type
    const eventsByType = [];
    const typeCount = {};
    events.forEach(event => {
      if (!typeCount[event.type]) {
        typeCount[event.type] = 0;
      }
      typeCount[event.type]++;
    });
    
    for (const [type, count] of Object.entries(typeCount)) {
      eventsByType.push({ type, count });
    }
    
    // Calculate events by month for the next 6 months
    const eventsByMonth = [];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                   'July', 'August', 'September', 'October', 'November', 'December'];
    
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    
    for (let i = 0; i < 6; i++) {
      const monthIndex = (currentMonth + i) % 12;
      const year = currentYear + Math.floor((currentMonth + i) / 12);
      const monthName = `${months[monthIndex]} ${year}`;
      
      const count = events.filter(event => {
        const eventDate = new Date(event.date);
        return eventDate.getMonth() === monthIndex && eventDate.getFullYear() === year;
      }).length;
      
      eventsByMonth.push({ month: monthName, count });
    }
    
    res.json({
      totalEvents,
      upcomingEvents,
      eventsByType,
      eventsByMonth,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new event
router.post('/', auth, async (req, res) => {
  try {
    const { title, date, time, type, description, relatedTo, onModel, location } = req.body;
    
    const event = new Event({
      title,
      date,
      time,
      type,
      user: req.user.id,
      description,
      relatedTo,
      onModel,
      location
    });
    
    await event.save();
    
    res.status(201).json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update event
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findById(id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Ensure user owns this event
    if (event.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { title, date, time, type, description, location, isCompleted } = req.body;
    
    // Update fields if provided
    if (title) event.title = title;
    if (date) event.date = date;
    if (time) event.time = time;
    if (type) event.type = type;
    if (description) event.description = description;
    if (location) event.location = location;
    if (isCompleted !== undefined) event.isCompleted = isCompleted;
    
    await event.save();
    
    res.json(event);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete event
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const event = await Event.findById(id);
    
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    // Ensure user owns this event
    if (event.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    await Event.deleteOne({ _id: id });
    
    res.json({ message: 'Event removed' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
