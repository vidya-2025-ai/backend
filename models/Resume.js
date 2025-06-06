
const mongoose = require('mongoose');

const ResumeSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    required: true
  },
  file: {
    type: String, // Store file as base64 string for uploaded resumes
  },
  personalInfo: {
    name: {
      type: String,
      required: true,
      default: 'Your Name'
    },
    email: {
      type: String,
      required: true,
      default: 'your.email@example.com'
    },
    phone: String,
    address: String,
    linkedin: String,
    website: String,
    summary: String
  },
  education: [{
    institution: {
      type: String,
      required: true
    },
    degree: {
      type: String,
      required: true
    },
    field: {
      type: String,
      required: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: Date,
    gpa: Number,
    description: String
  }],
  experience: [{
    company: {
      type: String,
      required: true
    },
    position: {
      type: String,
      required: true
    },
    location: String,
    startDate: {
      type: Date,
      required: true
    },
    endDate: Date,
    current: {
      type: Boolean,
      default: false
    },
    description: String
  }],
  skills: [{
    type: String
  }],
  projects: [{
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    technologies: [{
      type: String
    }],
    link: String,
    githubLink: String,
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ['Completed', 'In Progress', 'On Hold'],
      default: 'Completed'
    }
  }],
  certifications: [{
    name: {
      type: String,
      required: true
    },
    issuer: {
      type: String,
      required: true
    },
    date: Date,
    id: String
  }],
  atsScore: Number,
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Resume', ResumeSchema);
