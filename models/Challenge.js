
const mongoose = require('mongoose');

const SolutionSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  repositoryUrl: {
    type: String
  },
  attachments: [{
    type: String
  }],
  score: {
    type: Number,
    min: 0,
    max: 10
  },
  feedback: {
    type: String
  },
  status: {
    type: String,
    enum: ['submitted', 'evaluated'],
    default: 'submitted'
  },
  submittedAt: {
    type: Date,
    default: Date.now
  },
  evaluatedAt: {
    type: Date
  }
});

// Update evaluatedAt when status changes to evaluated
SolutionSchema.pre('save', function(next) {
  if (this.isModified('status') && this.status === 'evaluated') {
    this.evaluatedAt = new Date();
  }
  next();
});

const ChallengeSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  organizationName: {
    type: String,
    required: true
  },
  skillsRequired: [{
    type: String,
    trim: true
  }],
  deadline: {
    type: Date,
    required: true
  },
  solutions: [SolutionSchema],
  isActive: {
    type: Boolean,
    default: true
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

// Pre-save hook to update the updatedAt field
ChallengeSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Create virtual for solution count
ChallengeSchema.virtual('solutionCount').get(function() {
  return this.solutions.length;
});

// Create virtual for evaluated solutions count
ChallengeSchema.virtual('evaluatedCount').get(function() {
  return this.solutions.filter(sol => sol.status === 'evaluated').length;
});

// Create virtual for checking if deadline has passed
ChallengeSchema.virtual('isExpired').get(function() {
  return new Date() > this.deadline;
});

// Ensure virtuals are included when converting to JSON
ChallengeSchema.set('toJSON', { virtuals: true });
ChallengeSchema.set('toObject', { virtuals: true });

const Challenge = mongoose.model('Challenge', ChallengeSchema);
const Solution = mongoose.model('Solution', SolutionSchema);

module.exports = {
  Challenge,
  Solution
};
