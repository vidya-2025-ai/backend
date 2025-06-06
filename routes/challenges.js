
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const challengeController = require('../controllers/challengeController');
const solutionController = require('../controllers/solutionController');

// Challenge routes
router.get('/recruiter', auth, challengeController.getRecruiterChallenges);
router.get('/recruiter/statistics', auth, challengeController.getRecruiterStatistics);
router.get('/', challengeController.getAllChallenges);
router.post('/', auth, challengeController.createChallenge);
router.get('/:id', challengeController.getChallengeById);
router.put('/:id/status', auth, challengeController.toggleChallengeStatus);

// Solution routes
router.post('/:id/solutions', auth, solutionController.submitSolution);
router.get('/:id/solutions', auth, solutionController.getSolutions);
router.put('/:challengeId/solutions/:solutionId/evaluate', auth, solutionController.evaluateSolution);

module.exports = router;
