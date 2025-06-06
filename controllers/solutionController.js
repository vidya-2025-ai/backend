
const { Challenge } = require('../models/Challenge');
const User = require('../models/User');

// Submit solution to a challenge
exports.submitSolution = async (req, res) => {
  try {
    // Ensure user is a student
    if (req.user.role !== 'student') {
      return res.status(403).json({ message: 'Only students can submit solutions' });
    }
    
    const { id } = req.params;
    const { content, repositoryUrl, attachments } = req.body;
    
    if (!content) {
      return res.status(400).json({ message: 'Solution content is required' });
    }
    
    // Find the challenge
    const challenge = await Challenge.findById(id);
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }
    
    // Check if challenge is still active
    if (!challenge.isActive) {
      return res.status(400).json({ message: 'Challenge is no longer active' });
    }
    
    // Check if deadline has passed
    if (new Date() > challenge.deadline) {
      return res.status(400).json({ message: 'Challenge deadline has passed' });
    }
    
    // Check if student has already submitted
    const existingSolution = challenge.solutions.find(
      sol => sol.student.toString() === req.user.id
    );
    
    if (existingSolution) {
      return res.status(400).json({ message: 'You have already submitted a solution for this challenge' });
    }
    
    // Get student details
    const student = await User.findById(req.user.id);
    
    // Create solution
    const solution = {
      student: req.user.id,
      studentName: `${student.firstName} ${student.lastName}`,
      content,
      repositoryUrl: repositoryUrl || '',
      attachments: attachments || [],
      status: 'submitted',
      submittedAt: new Date()
    };
    
    // Add solution to challenge
    challenge.solutions.push(solution);
    await challenge.save();
    
    // Return the newly created solution
    const newSolution = challenge.solutions[challenge.solutions.length - 1];
    
    res.status(201).json({
      id: newSolution._id,
      challenge: id,
      student: {
        id: req.user.id,
        name: `${student.firstName} ${student.lastName}`
      },
      content: newSolution.content,
      repositoryUrl: newSolution.repositoryUrl,
      attachments: newSolution.attachments,
      status: newSolution.status,
      submittedAt: newSolution.submittedAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get solutions for a challenge (recruiters only)
exports.getSolutions = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the challenge
    const challenge = await Challenge.findById(id);
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }
    
    // If user is a recruiter, ensure they own this challenge
    if (req.user.role === 'recruiter' && challenge.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Format solutions for response
    const solutions = challenge.solutions.map(solution => ({
      id: solution._id,
      challenge: id,
      student: {
        id: solution.student,
        name: solution.studentName
      },
      content: solution.content,
      repositoryUrl: solution.repositoryUrl,
      attachments: solution.attachments,
      score: solution.score,
      feedback: solution.feedback,
      status: solution.status,
      submittedAt: solution.submittedAt,
      evaluatedAt: solution.evaluatedAt
    }));
    
    res.json(solutions);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Evaluate a solution (recruiters only)
exports.evaluateSolution = async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Only recruiters can evaluate solutions' });
    }
    
    const { challengeId, solutionId } = req.params;
    const { score, feedback } = req.body;
    
    if (score === undefined || score < 0 || score > 10) {
      return res.status(400).json({ message: 'Score must be between 0 and 10' });
    }
    
    // Find the challenge
    const challenge = await Challenge.findById(challengeId);
    if (!challenge) {
      return res.status(404).json({ message: 'Challenge not found' });
    }
    
    // Ensure recruiter owns this challenge
    if (challenge.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Find the solution
    const solution = challenge.solutions.id(solutionId);
    if (!solution) {
      return res.status(404).json({ message: 'Solution not found' });
    }
    
    // Update solution
    solution.score = score;
    solution.feedback = feedback || '';
    solution.status = 'evaluated';
    solution.evaluatedAt = new Date();
    
    await challenge.save();
    
    res.json({
      id: solution._id,
      challenge: challengeId,
      student: {
        id: solution.student,
        name: solution.studentName
      },
      content: solution.content,
      repositoryUrl: solution.repositoryUrl,
      attachments: solution.attachments,
      score: solution.score,
      feedback: solution.feedback,
      status: solution.status,
      submittedAt: solution.submittedAt,
      evaluatedAt: solution.evaluatedAt
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};
