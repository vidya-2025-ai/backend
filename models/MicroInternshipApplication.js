
const mongoose = require('mongoose');

const MicroInternshipApplicationSchema = new mongoose.Schema({
  internship: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MicroInternship',
    required: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  studentName: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'rejected', 'shortlisted'],
    default: 'pending'
  },
  appliedAt: {
    type: Date,
    default: Date.now
  },
  coverLetter: String,
  resume: String
});

module.exports = mongoose.model('MicroInternshipApplication', MicroInternshipApplicationSchema);
