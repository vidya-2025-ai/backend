
const mongoose = require('mongoose');

const ApplicationSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  opportunity: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Opportunity',
    required: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Under Review', 'Shortlisted', 'Interview', 'Accepted', 'Rejected'],
    default: 'Pending'
  },
  appliedDate: {
    type: Date,
    default: Date.now
  },
  resumeUrl: {
    type: String
  },
  coverLetter: {
    type: String
  },
  notes: {
    type: String
  },
  activities: [{
    type: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  rating: {
    type: Number,
    min: 1,
    max: 5
  },
  interviewDate: {
    type: Date
  },
  feedback: {
    type: String
  },
  skillMatch: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  review: {
    strengths: [String],
    weaknesses: [String],
    overallAssessment: String,
    recommendationLevel: {
      type: String,
      enum: ['Highly Recommended', 'Recommended', 'Neutral', 'Not Recommended'],
      default: 'Neutral'
    },
    reviewDate: {
      type: Date,
      default: Date.now
    }
  }
});

// Add virtual for id
ApplicationSchema.virtual('id').get(function() {
  return this._id.toHexString();
});

// Ensure virtual fields are serialized
ApplicationSchema.set('toJSON', {
  virtuals: true
});

// Add indexes for better query performance
ApplicationSchema.index({ student: 1, appliedDate: -1 });
ApplicationSchema.index({ opportunity: 1, appliedDate: -1 });
ApplicationSchema.index({ status: 1 });
ApplicationSchema.index({ 'opportunity': 1, 'status': 1 });

// Pre-save middleware to update lastUpdated
ApplicationSchema.pre('save', function(next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model('Application', ApplicationSchema);
