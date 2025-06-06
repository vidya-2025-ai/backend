
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Application = require('../models/Application');
const Opportunity = require('../models/Opportunity');
const Mentorship = require('../models/Mentorship');
const { UserSkill } = require('../models/Skill');

// Get dashboard statistics for recruiter
router.get('/recruiter/stats', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Get all opportunities by this recruiter
    const activeOpportunities = await Opportunity.find({ 
      organization: req.user.id,
      isActive: true 
    });
    
    // Get opportunity IDs
    const opportunityIds = activeOpportunities.map(opp => opp._id);
    
    // Get applications for the recruiter's opportunities
    const applications = await Application.find({
      opportunity: { $in: opportunityIds }
    });
    
    // Count interviews scheduled
    const interviewsScheduled = applications.filter(app => 
      app.status === 'Interview' && app.interviewDate
    ).length;
    
    // Get mentorship matches
    const mentorshipMatches = await Mentorship.countDocuments({
      mentor: req.user.id,
      status: 'accepted'
    });
    
    // Get talent pool size (candidates who applied to your opportunities)
    const talentPoolSize = await Application.aggregate([
      { $match: { opportunity: { $in: opportunityIds } } },
      { $group: { _id: "$student" } },
      { $count: "totalCandidates" }
    ]);
    
    const totalCandidates = talentPoolSize.length > 0 ? talentPoolSize[0].totalCandidates : 0;
    
    res.json({
      activeJobs: activeOpportunities.length,
      totalApplications: applications.length,
      interviewsScheduled,
      mentorshipMatches,
      talentPoolSize: totalCandidates
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recent applications for recruiter
router.get('/recruiter/recent', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { limit = 5 } = req.query;
    
    // Get all opportunities by this recruiter
    const opportunities = await Opportunity.find({ 
      organization: req.user.id 
    });
    
    // Get opportunity IDs
    const opportunityIds = opportunities.map(opp => opp._id);
    
    // Get recent applications
    const recentApplications = await Application.find({
      opportunity: { $in: opportunityIds }
    })
    .populate('student', 'firstName lastName email avatar skills')
    .populate('opportunity', 'title type')
    .sort({ appliedDate: -1 })
    .limit(parseInt(limit));
    
    res.json(recentApplications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get talent stats for recruiter
router.get('/recruiter/talent', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    // Get all opportunities by this recruiter
    const opportunities = await Opportunity.find({ 
      organization: req.user.id 
    });
    
    // Get opportunity IDs and required skills
    const opportunityIds = opportunities.map(opp => opp._id);
    const requiredSkills = [...new Set(opportunities.flatMap(opp => opp.skillsRequired || []))];
    
    // Get applications for these opportunities
    const applications = await Application.find({
      opportunity: { $in: opportunityIds }
    }).populate('student', 'skills yearsOfExperience education');
    
    // Analyze education distribution
    const educationDistribution = applications.reduce((acc, app) => {
      const student = app.student;
      if (student.education && student.education.length > 0) {
        const highestDegree = student.education.sort((a, b) => {
          const degreeRank = { "Bachelor's": 1, "Master's": 2, "PhD": 3, "Associate": 0, "High School": -1 };
          return (degreeRank[b.degree] || 0) - (degreeRank[a.degree] || 0);
        })[0];
        
        if (highestDegree) {
          acc[highestDegree.degree] = (acc[highestDegree.degree] || 0) + 1;
        }
      }
      return acc;
    }, {});
    
    // Analyze experience distribution
    const experienceDistribution = applications.reduce((acc, app) => {
      const years = app.student.yearsOfExperience || 0;
      if (years < 2) acc.entry = (acc.entry || 0) + 1;
      else if (years < 5) acc.mid = (acc.mid || 0) + 1;
      else acc.senior = (acc.senior || 0) + 1;
      return acc;
    }, { entry: 0, mid: 0, senior: 0 });
    
    // Analyze skill match rate
    const skillMatchData = applications.map(app => {
      const studentSkills = app.student.skills || [];
      const matchingSkills = requiredSkills.filter(skill => 
        studentSkills.includes(skill)
      );
      return {
        matchRate: requiredSkills.length > 0 
          ? (matchingSkills.length / requiredSkills.length) * 100 
          : 0
      };
    });
    
    const averageSkillMatch = skillMatchData.length > 0 
      ? skillMatchData.reduce((sum, item) => sum + item.matchRate, 0) / skillMatchData.length 
      : 0;
    
    res.json({
      talentPoolSize: applications.length,
      educationDistribution,
      experienceDistribution,
      averageSkillMatch,
      skillGaps: requiredSkills.filter(skill => {
        const candidatesWithSkill = applications.filter(app => 
          app.student.skills && app.student.skills.includes(skill)
        ).length;
        return candidatesWithSkill / applications.length < 0.3; // Skills where less than 30% of candidates have it
      })
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
