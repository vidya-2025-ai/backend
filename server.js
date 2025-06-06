
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/opportunities', require('./routes/opportunities'));
app.use('/api/applications', require('./routes/applications'));
app.use('/api/resume', require('./routes/resume'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/ats', require('./routes/ats'));
app.use('/api/career', require('./routes/career'));
app.use('/api/mentorship', require('./routes/mentorship'));
app.use('/api/certificates', require('./routes/certificates'));
app.use('/api/candidates', require('./routes/candidates'));
app.use('/api/interviews', require('./routes/interviews'));
app.use('/api/events', require('./routes/events'));
app.use('/api/micro-internships', require('./routes/micro-internships'));
app.use('/api/skills', require('./routes/skills'));
app.use('/api/challenges', require('./routes/challenges'));

// Test endpoint to verify server is running
app.get('/api/test', (req, res) => {
  res.json({ message: 'Backend server is running successfully!' });
});

// Test endpoints for each service
app.get('/api/mentorship/test', (req, res) => {
  res.json({ message: 'Mentorship API is working!' });
});

app.get('/api/certificates/test', (req, res) => {
  res.json({ message: 'Certificates API is working!' });
});

app.get('/api/skills/test', (req, res) => {
  res.json({ message: 'Skills API is working!' });
});

app.get('/api/challenges/test', (req, res) => {
  res.json({ message: 'Challenges API is working!' });
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/internship-platform', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api`);
  console.log(`Mentorship API: http://localhost:${PORT}/api/mentorship`);
  console.log(`Certificates API: http://localhost:${PORT}/api/certificates`);
  console.log(`Candidates API: http://localhost:${PORT}/api/candidates`);
  console.log(`Skills API: http://localhost:${PORT}/api/skills`);
  console.log(`Challenges API: http://localhost:${PORT}/api/challenges`);
  console.log(`Micro-internships API: http://localhost:${PORT}/api/micro-internships`);
});
