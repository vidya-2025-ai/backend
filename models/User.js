
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true
  },
  lastName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['student', 'recruiter'],
    required: true
  },
  organization: {
    type: String,
    required: function() {
      return this.role === 'recruiter';
    }
  },
  jobTitle: {
    type: String,
    required: function() {
      return this.role === 'recruiter';
    }
  },
  skills: [{
    type: String
  }],
  bio: String,
  avatar: String,
  education: [{
    institution: String,
    degree: String,
    field: String,
    startDate: Date,
    endDate: Date,
    current: Boolean,
    description: String
  }],
  experience: [{
    company: String,
    position: String,
    location: String,
    startDate: Date,
    endDate: Date,
    current: Boolean,
    description: String
  }],
  socialLinks: {
    linkedin: String,
    github: String,
    twitter: String,
    portfolio: String
  },
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    applicationUpdates: {
      type: Boolean,
      default: true
    },
    marketingEmails: {
      type: Boolean,
      default: false
    },
    newOpportunities: {
      type: Boolean,
      default: true
    },
    realTimeAlerts: {
      type: Boolean,
      default: true
    },
    messageNotifications: {
      type: Boolean,
      default: true
    },
    systemUpdates: {
      type: Boolean,
      default: true
    },
    challengeSubmissions: {
      type: Boolean,
      default: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastActive: {
    type: Date,
    default: Date.now
  },
  careerInterests: [{
    type: String
  }],
  yearsOfExperience: {
    type: Number,
    default: 0
  },
  location: {
    type: String
  },
  availability: {
    type: String,
    enum: ['Immediate', '2 Weeks', 'Month', 'Negotiable'],
    default: 'Negotiable'
  },
  profileCompleteness: {
    type: Number,
    default: 0
  },
  savedOpportunities: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Opportunity'
  }]
});

// Add indexes for better search performance
UserSchema.index({ role: 1 });
UserSchema.index({ skills: 1 });
UserSchema.index({ location: 1 });
UserSchema.index({ availability: 1 });
UserSchema.index({ firstName: 'text', lastName: 'text' });

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Calculate profile completeness before saving
UserSchema.pre('save', function(next) {
  if (this.role === 'student') {
    let completedFields = 0;
    const totalFields = 8;

    // Check required fields
    if (this.firstName && this.firstName.trim()) completedFields++;
    if (this.lastName && this.lastName.trim()) completedFields++;
    if (this.email && this.email.trim()) completedFields++;
    if (this.bio && this.bio.trim()) completedFields++;
    if (this.skills && this.skills.length > 0) completedFields++;
    if (this.education && this.education.length > 0) completedFields++;
    if (this.location && this.location.trim()) completedFields++;
    if (this.availability) completedFields++;

    this.profileCompleteness = Math.round((completedFields / totalFields) * 100);
  }
  next();
});

// Method to compare password
UserSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
