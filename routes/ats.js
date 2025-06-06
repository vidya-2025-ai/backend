
const express = require('express');
const auth = require('../middleware/auth');
const ATSParameter = require('../models/ATSParameter');
const Resume = require('../models/Resume');
const Opportunity = require('../models/Opportunity');
const router = express.Router();

// Get ATS parameters for a recruiter
router.get('/parameters', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const parameters = await ATSParameter.find({ recruiter: req.user.id });
    res.json(parameters);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create new ATS parameters
router.post('/parameters', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const {
      name,
      requiredSkills,
      requiredExperience,
      requiredEducation,
      keywords,
      formatRequirements
    } = req.body;
    
    const parameter = new ATSParameter({
      recruiter: req.user.id,
      name,
      requiredSkills,
      requiredExperience,
      requiredEducation,
      keywords,
      formatRequirements
    });
    
    await parameter.save();
    
    res.status(201).json(parameter);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update ATS parameters
router.put('/parameters/:id', auth, async (req, res) => {
  try {
    // Ensure user is a recruiter
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const { id } = req.params;
    
    const parameter = await ATSParameter.findById(id);
    
    if (!parameter) {
      return res.status(404).json({ message: 'ATS parameter not found' });
    }
    
    // Ensure recruiter owns these parameters
    if (parameter.recruiter.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const {
      name,
      requiredSkills,
      requiredExperience,
      requiredEducation,
      keywords,
      formatRequirements,
      active
    } = req.body;
    
    // Update fields if provided
    if (name) parameter.name = name;
    if (requiredSkills) parameter.requiredSkills = requiredSkills;
    if (requiredExperience !== undefined) parameter.requiredExperience = requiredExperience;
    if (requiredEducation) parameter.requiredEducation = requiredEducation;
    if (keywords) parameter.keywords = keywords;
    if (formatRequirements) parameter.formatRequirements = formatRequirements;
    if (active !== undefined) parameter.active = active;
    
    await parameter.save();
    
    res.json(parameter);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Calculate ATS score for a resume
router.post('/calculate-score', auth, async (req, res) => {
  try {
    const { resumeId, parameterId } = req.body;
    
    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }
    
    // Ensure user owns this resume if they're a student
    if (req.user.role === 'student' && resume.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const parameter = await ATSParameter.findById(parameterId);
    if (!parameter) {
      return res.status(404).json({ message: 'ATS parameter not found' });
    }
    
    // Simple ATS score calculation (this would be more complex in a real application)
    let score = 0;
    let maxScore = 0;
    
    // Check for required skills
    if (parameter.requiredSkills && parameter.requiredSkills.length > 0) {
      parameter.requiredSkills.forEach(reqSkill => {
        maxScore += reqSkill.weight || 1;
        if (resume.skills && resume.skills.includes(reqSkill.skill)) {
          score += reqSkill.weight || 1;
        }
      });
    }
    
    // Check for keywords in resume
    if (parameter.keywords && parameter.keywords.length > 0) {
      parameter.keywords.forEach(keyword => {
        maxScore += keyword.weight || 1;
        
        // Check keywords in various sections (simplified approach)
        const resumeText = JSON.stringify(resume).toLowerCase();
        if (resumeText.includes(keyword.keyword.toLowerCase())) {
          score += keyword.weight || 1;
        }
      });
    }
    
    // Format requirements check
    if (parameter.formatRequirements) {
      if (parameter.formatRequirements.requiresContactInfo) {
        maxScore += 1;
        if (resume.personalInfo && resume.personalInfo.email && resume.personalInfo.phone) {
          score += 1;
        }
      }
      
      if (parameter.formatRequirements.requiresEducation) {
        maxScore += 1;
        if (resume.education && resume.education.length > 0) {
          score += 1;
        }
      }
    }
    
    // Ensure we have a minimum score base
    if (maxScore === 0) {
      maxScore = 10; // Default scoring
      score = 5; // Default partial score
    }
    
    const finalScore = Math.round((score / maxScore) * 100);
    
    // Update the resume with the ATS score
    resume.atsScore = finalScore;
    await resume.save();
    
    res.json({ 
      score: finalScore,
      details: {
        matched: score,
        total: maxScore
      }
    });
  } catch (error) {
    console.error('ATS Score calculation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Calculate ATS score for a resume against an opportunity
router.post('/calculate-opportunity-score', auth, async (req, res) => {
  try {
    const { resumeId, opportunityId } = req.body;
    
    const resume = await Resume.findById(resumeId);
    if (!resume) {
      return res.status(404).json({ message: 'Resume not found' });
    }
    
    // Ensure user owns this resume if they're a student
    if (req.user.role === 'student' && resume.user.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    
    const opportunity = await Opportunity.findById(opportunityId);
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }
    
    // Calculate ATS score based on opportunity requirements
    let score = 0;
    let maxScore = 0;
    
    // Create dynamic ATS parameters based on the opportunity
    const opportunitySkills = (opportunity.skillsRequired || []).map(skill => ({
      skill,
      weight: 5 // Default weight
    }));
    
    // Extract keywords from opportunity description and title
    const opportunityText = `${opportunity.title} ${opportunity.description || ''}`;
    const descriptionWords = opportunityText
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3); // Only words longer than 3 chars
    
    // Remove duplicate words and transform to keyword objects
    const opportunityKeywords = [...new Set(descriptionWords)].slice(0, 20).map(keyword => ({
      keyword,
      weight: 2 // Default weight
    }));
    
    // Check for required skills match
    opportunitySkills.forEach(reqSkill => {
      maxScore += reqSkill.weight;
      if (resume.skills && resume.skills.includes(reqSkill.skill)) {
        score += reqSkill.weight;
      }
    });
    
    // Check for keywords in resume
    opportunityKeywords.forEach(keyword => {
      maxScore += keyword.weight;
      
      // Check keywords in various sections (simplified approach)
      const resumeText = JSON.stringify(resume).toLowerCase();
      if (resumeText.includes(keyword.keyword.toLowerCase())) {
        score += keyword.weight;
      }
    });
    
    // Check for education match if required by opportunity
    if (opportunity.experienceLevel === 'Entry-Level') {
      maxScore += 3;
      if (resume.education && resume.education.length > 0) {
        score += 3;
      }
    } else if (opportunity.experienceLevel === 'Advanced' || opportunity.experienceLevel === 'Senior') {
      // Check for work experience
      maxScore += 5;
      if (resume.experience && resume.experience.length > 0) {
        const totalYearsExperience = resume.experience.reduce((total, exp) => {
          // Simple calculation, could be more sophisticated in a real app
          const startDate = new Date(exp.startDate);
          const endDate = exp.current ? new Date() : new Date(exp.endDate);
          const years = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365);
          return total + Math.max(0, years);
        }, 0);
        
        // Score based on years of experience
        if (totalYearsExperience >= 5) {
          score += 5;
        } else if (totalYearsExperience >= 3) {
          score += 3;
        } else if (totalYearsExperience >= 1) {
          score += 1;
        }
      }
    }
    
    // Basic format check
    maxScore += 2;
    if (resume.personalInfo && resume.personalInfo.email) {
      score += 2;
    }
    
    // Ensure we have a minimum score base
    if (maxScore === 0) {
      maxScore = 10; // Default scoring
      score = 3; // Default partial score
    }
    
    const finalScore = Math.round((score / maxScore) * 100);
    
    // Update the resume with the ATS score
    resume.atsScore = finalScore;
    await resume.save();
    
    res.json({ 
      score: finalScore,
      details: {
        matched: score,
        total: maxScore,
        opportunityTitle: opportunity.title
      }
    });
  } catch (error) {
    console.error('ATS Opportunity Score calculation error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
