
const mongoose = require('mongoose');

const ATSParameterSchema = new mongoose.Schema({
  recruiter: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  requiredSkills: [{
    skill: {
      type: String,
      required: true
    },
    weight: {
      type: Number,
      default: 1,
      min: 1,
      max: 10
    }
  }],
  requiredExperience: {
    type: Number,
    default: 0
  },
  requiredEducation: {
    type: String
  },
  keywords: [{
    keyword: {
      type: String,
      required: true
    },
    weight: {
      type: Number,
      default: 1,
      min: 1,
      max: 5
    }
  }],
  formatRequirements: {
    preferredLength: Number,
    requiresContactInfo: {
      type: Boolean,
      default: true
    },
    requiresEducation: {
      type: Boolean,
      default: true
    }
  },
  active: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('ATSParameter', ATSParameterSchema);
