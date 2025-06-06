
const express = require('express');
const auth = require('../middleware/auth');
const Certificate = require('../models/Certificate');
const router = express.Router();

// Get all certificates for a student
router.get('/', auth, async (req, res) => {
  try {
    // Ensure user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const certificates = await Certificate.find({ student: req.user.id })
      .sort({ issueDate: -1 });
      
    res.json(certificates);
  } catch (error) {
    console.error('Error fetching certificates:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new certificate
router.post('/', auth, async (req, res) => {
  try {
    // Ensure user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can upload certificates' });
    }

    const { title, issuer, issueDate, expiryDate, credentialId, credentialUrl, certificateImage, skills, status } = req.body;
    
    // Validate required fields
    if (!title || !issuer || !issueDate) {
      return res.status(400).json({ message: 'Title, issuer, and issue date are required' });
    }
    
    const certificate = new Certificate({
      title,
      issuer,
      student: req.user.id,
      issueDate: new Date(issueDate),
      expiryDate: expiryDate ? new Date(expiryDate) : null,
      credentialId: credentialId || '',
      credentialUrl: credentialUrl || '',
      certificateImage: certificateImage || '',
      skills: skills || [],
      status: status || 'Completed'
    });
    
    await certificate.save();
    
    res.status(201).json(certificate);
  } catch (error) {
    console.error('Error creating certificate:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Get certificate by id
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const certificate = await Certificate.findById(id);
    
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    
    // Ensure user owns this certificate
    if (certificate.student.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    res.json(certificate);
  } catch (error) {
    console.error('Error fetching certificate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update certificate
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const certificate = await Certificate.findById(id);
    
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    
    // Ensure user owns this certificate
    if (certificate.student.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { title, issuer, issueDate, expiryDate, credentialId, credentialUrl, certificateImage, skills, status } = req.body;
    
    // Update fields if provided
    if (title) certificate.title = title;
    if (issuer) certificate.issuer = issuer;
    if (issueDate) certificate.issueDate = new Date(issueDate);
    if (expiryDate !== undefined) certificate.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (credentialId !== undefined) certificate.credentialId = credentialId;
    if (credentialUrl !== undefined) certificate.credentialUrl = credentialUrl;
    if (certificateImage !== undefined) certificate.certificateImage = certificateImage;
    if (skills !== undefined) certificate.skills = skills;
    if (status) certificate.status = status;
    
    await certificate.save();
    
    res.json(certificate);
  } catch (error) {
    console.error('Error updating certificate:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete certificate
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const certificate = await Certificate.findById(id);
    
    if (!certificate) {
      return res.status(404).json({ message: 'Certificate not found' });
    }
    
    // Ensure user owns this certificate
    if (certificate.student.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    await Certificate.findByIdAndDelete(id);
    
    res.json({ message: 'Certificate deleted successfully' });
  } catch (error) {
    console.error('Error deleting certificate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
