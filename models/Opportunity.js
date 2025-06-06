
const mongoose = require('mongoose');

const OpportunitySchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  description: {
    type: String,
    required: true
  },
  requirements: [{
    type: String
  }],
  location: {
    type: String
  },
  type: {
    type: String,
    enum: ['Internship', 'Research', 'Volunteer', 'Part-time', 'Full-time'],
    default: 'Internship'
  },
  duration: {
    type: String,
    required: true
  },
  stipend: {
    amount: {
      type: Number,
      default: 0
    },
    currency: {
      type: String,
      default: 'INR'
    }
  },
  deadline: {
    type: Date
  },
  skillsRequired: [{
    type: String
  }],
  tags: [{
    type: String
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  applications: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Application'
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  category: {
    type: String,
    enum: ['Technology', 'Business', 'Design', 'Marketing', 'Healthcare', 'Education', 'Other'],
    default: 'Technology'
  },
  experienceLevel: {
    type: String,
    enum: ['Entry-Level', 'Intermediate', 'Advanced', 'Senior'],
    default: 'Entry-Level'
  },
  applicationCount: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  }
});

// Add virtual for id
OpportunitySchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Ensure virtual fields are serialized
OpportunitySchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Opportunity', OpportunitySchema);
