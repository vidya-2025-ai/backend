
const express = require('express');
const auth = require('../middleware/auth');
const { Skill, UserSkill } = require('../models/Skill');
const Application = require('../models/Application');
const User = require('../models/User');
const router = express.Router();

// Get all skills
router.get('/all', async (req, res) => {
  try {
    const skills = await Skill.find();
    res.json(skills);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get skills by category
router.get('/categories', async (req, res) => {
  try {
    const categories = await Skill.aggregate([
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json(categories.map(c => ({ category: c._id, count: c.count })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get user skills
router.get('/user', auth, async (req, res) => {
  try {
    const userSkills = await UserSkill.find({ user: req.user.id })
      .populate('skill');
    
    res.json(userSkills);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add user skill
router.post('/user', auth, async (req, res) => {
  try {
    const { skillId, level } = req.body;
    
    // Check if skill exists
    const skill = await Skill.findById(skillId);
    if (!skill) {
      return res.status(404).json({ message: 'Skill not found' });
    }
    
    // Check if user already has this skill
    let userSkill = await UserSkill.findOne({ 
      user: req.user.id, 
      skill: skillId 
    });
    
    if (userSkill) {
      // Update level if skill already exists
      userSkill.level = level;
    } else {
      // Create new user skill
      userSkill = new UserSkill({
        user: req.user.id,
        skill: skillId,
        level
      });
    }
    
    await userSkill.save();
    
    res.json(userSkill);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add skill assessment
router.post('/user/:skillId/assessment', auth, async (req, res) => {
  try {
    const { skillId } = req.params;
    const { score, certificateId } = req.body;
    
    // Find user skill
    const userSkill = await UserSkill.findOne({
      user: req.user.id,
      skill: skillId
    });
    
    if (!userSkill) {
      return res.status(404).json({ message: 'User skill not found' });
    }
    
    // Add assessment
    userSkill.assessments.push({
      score,
      certificate: certificateId
    });
    
    await userSkill.save();
    
    res.json(userSkill);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get assessment data for recruiter dashboard - Enhanced for recruiter-specific tracking
router.get('/assessments/stats', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    // Get applications for opportunities posted by this recruiter
    const recruiterApplications = await Application.find()
      .populate({
        path: 'opportunity',
        match: { organization: req.user.id }
      })
      .populate('student')
      .exec();
    
    // Filter out applications where opportunity is null (not posted by this recruiter)
    const validApplications = recruiterApplications.filter(app => app.opportunity);
    
    // Get candidate IDs from applications
    const candidateIds = validApplications.map(app => app.student._id || app.student.id);
    
    // Get skills data for candidates who applied to this recruiter's opportunities
    const candidateSkills = await UserSkill.find({ 
      user: { $in: candidateIds } 
    }).populate('skill').populate('user');
    
    // Get top skills among candidates
    const skillStats = {};
    candidateSkills.forEach(userSkill => {
      const skillName = userSkill.skill.name;
      if (!skillStats[skillName]) {
        skillStats[skillName] = {
          _id: userSkill.skill._id,
          name: skillName,
          category: userSkill.skill.category,
          userCount: 0,
          totalScore: 0,
          assessmentCount: 0
        };
      }
      skillStats[skillName].userCount++;
      skillStats[skillName].totalScore += userSkill.level;
      skillStats[skillName].assessmentCount += userSkill.assessments.length;
    });
    
    const topSkills = Object.values(skillStats)
      .map(skill => ({
        ...skill,
        averageScore: skill.userCount > 0 ? skill.totalScore / skill.userCount : 0
      }))
      .sort((a, b) => b.userCount - a.userCount)
      .slice(0, 10);
    
    // Get skill distribution by category for candidates
    const skillsByCategory = await Skill.aggregate([
      { 
        $lookup: {
          from: 'userskills',
          localField: '_id',
          foreignField: 'skill',
          as: 'userSkills'
        }
      },
      {
        $match: {
          'userSkills.user': { $in: candidateIds }
        }
      },
      { 
        $group: { 
          _id: "$category", 
          count: { $sum: 1 } 
        } 
      },
      { $sort: { count: -1 } }
    ]);

    // Get assessment score distribution for candidates
    const assessmentScores = candidateSkills.reduce((acc, userSkill) => {
      const scoreRange = Math.floor(userSkill.level);
      acc[scoreRange] = (acc[scoreRange] || 0) + 1;
      return acc;
    }, {});
    
    const formattedScores = Object.entries(assessmentScores).map(([score, count]) => ({
      score: parseInt(score),
      count
    })).sort((a, b) => a.score - b.score);
    
    res.json({
      topSkills,
      skillsByCategory: skillsByCategory.map(c => ({ category: c._id, count: c.count })),
      assessmentScores: formattedScores,
      totalCandidates: candidateIds.length,
      totalAssessments: candidateSkills.reduce((sum, skill) => sum + skill.assessments.length, 0)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get detailed candidate assessments for a specific opportunity
router.get('/assessments/opportunity/:opportunityId', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Not authorized' });
    }
    
    const { opportunityId } = req.params;
    
    // Get applications for this opportunity
    const applications = await Application.find({ opportunity: opportunityId })
      .populate('student')
      .exec();
    
    const candidateIds = applications.map(app => app.student._id || app.student.id);
    
    // Get skills and assessments for these candidates
    const candidateSkills = await UserSkill.find({ 
      user: { $in: candidateIds } 
    })
    .populate('skill')
    .populate('user');
    
    // Group by candidate
    const candidateAssessments = {};
    candidateSkills.forEach(userSkill => {
      const userId = userSkill.user._id.toString();
      if (!candidateAssessments[userId]) {
        candidateAssessments[userId] = {
          candidate: userSkill.user,
          skills: [],
          totalAssessments: 0,
          averageScore: 0
        };
      }
      
      candidateAssessments[userId].skills.push({
        skill: userSkill.skill,
        level: userSkill.level,
        assessments: userSkill.assessments
      });
      
      candidateAssessments[userId].totalAssessments += userSkill.assessments.length;
    });
    
    // Calculate average scores
    Object.values(candidateAssessments).forEach(candidate => {
      if (candidate.skills.length > 0) {
        candidate.averageScore = candidate.skills.reduce((sum, skill) => sum + skill.level, 0) / candidate.skills.length;
      }
    });
    
    res.json(Object.values(candidateAssessments));
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
