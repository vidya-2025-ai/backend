const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const Resume = require('../models/Resume');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'));
    }
  }
});

// Get all resumes for a user
router.get('/', auth, async (req, res) => {
  try {
    const resumes = await Resume.find({ user: req.user.id });
    res.json(resumes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get resume by id
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const resume = await Resume.findById(id);
    
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }
    
    // Ensure user owns this resume
    if (resume.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    res.json(resume);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Upload resume file
router.post('/upload', auth, upload.single('resume'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Create a new resume entry with the uploaded file
    const resume = new Resume({
      user: req.user.id,
      title: req.file.originalname.replace(/\.[^/.]+$/, ""), // Remove file extension
      file: req.file.buffer.toString('base64'), // Store file as base64
      personalInfo: {
        name: 'Your Name',
        email: 'your.email@example.com',
        phone: '',
        address: '',
        linkedin: '',
        website: '',
        summary: ''
      },
      education: [],
      experience: [],
      skills: [],
      projects: [],
      certifications: [],
      lastUpdated: new Date()
    });

    await resume.save();
    res.status(201).json(resume);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Create new resume
router.post('/', auth, async (req, res) => {
  try {
    const {
      title,
      personalInfo = {},
      education = [],
      experience = [],
      skills = [],
      projects = [],
      certifications = []
    } = req.body;
    
    // Ensure personalInfo has the required fields
    const sanitizedPersonalInfo = {
      name: personalInfo.name || 'Your Name',
      email: personalInfo.email || 'your.email@example.com',
      phone: personalInfo.phone || '',
      address: personalInfo.address || '',
      linkedin: personalInfo.linkedin || '',
      website: personalInfo.website || ''
    };
    
    const resume = new Resume({
      user: req.user.id,
      title: title || 'My Resume',
      personalInfo: sanitizedPersonalInfo,
      education,
      experience,
      skills,
      projects,
      certifications,
      lastUpdated: new Date()
    });
    
    await resume.save();
    
    res.status(201).json(resume);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Update resume
router.put('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const resume = await Resume.findById(id);
    
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }
    
    // Ensure user owns this resume
    if (resume.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const {
      title,
      personalInfo,
      education,
      experience,
      skills,
      projects,
      certifications
    } = req.body;
    
    // Update resume fields if provided
    if (title) resume.title = title;
    
    if (personalInfo) {
      // Ensure required fields
      resume.personalInfo.name = personalInfo.name || resume.personalInfo.name || 'Your Name';
      resume.personalInfo.email = personalInfo.email || resume.personalInfo.email || 'your.email@example.com';
      
      // Update other fields if provided
      if (personalInfo.phone !== undefined) resume.personalInfo.phone = personalInfo.phone;
      if (personalInfo.address !== undefined) resume.personalInfo.address = personalInfo.address;
      if (personalInfo.linkedin !== undefined) resume.personalInfo.linkedin = personalInfo.linkedin;
      if (personalInfo.website !== undefined) resume.personalInfo.website = personalInfo.website;
      if (personalInfo.summary !== undefined) resume.personalInfo.summary = personalInfo.summary;
    }
    
    if (education) resume.education = education;
    if (experience) resume.experience = experience;
    if (skills) resume.skills = skills;
    if (projects) resume.projects = projects;
    if (certifications) resume.certifications = certifications;
    
    resume.lastUpdated = new Date();
    
    await resume.save();
    
    res.json(resume);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Delete resume
router.delete('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    const resume = await Resume.findById(id);
    
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }
    
    // Ensure user owns this resume
    if (resume.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    await Resume.findByIdAndDelete(id);
    
    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
