
const mongoose = require('mongoose');

const CertificateSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  issuer: {
    type: String,
    required: true,
    trim: true
  },
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  issueDate: {
    type: Date,
    required: true
  },
  expiryDate: {
    type: Date,
    default: null
  },
  credentialId: {
    type: String,
    default: '',
    trim: true
  },
  credentialUrl: {
    type: String,
    default: '',
    trim: true
  },
  certificateImage: {
    type: String,
    default: ''
  },
  skills: [{
    type: String,
    trim: true
  }],
  status: {
    type: String,
    enum: ['In Progress', 'Completed'],
    default: 'Completed'
  },
  verificationLink: {
    type: String,
    default: ''
  },
  issuedBy: {
    type: String,
    default: function() {
      return this.issuer;
    }
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
CertificateSchema.index({ student: 1 });
CertificateSchema.index({ issueDate: -1 });
CertificateSchema.index({ status: 1 });

// Update the updatedAt field before saving
CertificateSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  if (!this.verificationLink && this.credentialUrl) {
    this.verificationLink = this.credentialUrl;
  }
  if (!this.issuedBy && this.issuer) {
    this.issuedBy = this.issuer;
  }
  next();
});

module.exports = mongoose.model('Certificate', CertificateSchema);
