
const mongoose = require('mongoose');

const MentorshipSchema = new mongoose.Schema({
  mentor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: function() {
      return !this.programDetails?.isProgram;
    }
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected'],
    default: 'pending'
  },
  message: {
    type: String,
    required: true
  },
  topic: {
    type: String,
    default: 'General Mentorship'
  },
  programDetails: {
    isProgram: {
      type: Boolean,
      default: false
    },
    duration: String,
    skillsOffered: [String],
    maxParticipants: {
      type: Number,
      default: 10
    },
    currentParticipants: {
      type: Number,
      default: 0
    },
    requirements: [String]
  },
  applicationDetails: {
    programId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Mentorship'
    },
    appliedAt: Date
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

// Add indexes for better performance
MentorshipSchema.index({ mentor: 1, student: 1 });
MentorshipSchema.index({ status: 1 });
MentorshipSchema.index({ createdAt: -1 });
MentorshipSchema.index({ 'programDetails.isProgram': 1 });

module.exports = mongoose.model('Mentorship', MentorshipSchema);
