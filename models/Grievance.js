
const mongoose = require('mongoose');

const ResponseSchema = new mongoose.Schema({
  content: {
    type: String,
    required: true
  },
  responder: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  responderName: {
    type: String,
    required: true
  },
  responderRole: {
    type: String,
    enum: ['student', 'recruiter'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const GrievanceSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'resolved', 'closed'],
    default: 'pending'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  creatorName: {
    type: String,
    required: true
  },
  creatorRole: {
    type: String,
    enum: ['student', 'recruiter'],
    required: true
  },
  responses: [ResponseSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Grievance', GrievanceSchema);
