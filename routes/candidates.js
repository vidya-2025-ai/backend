const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Resume = require('../models/Resume');
const Opportunity = require('../models/Opportunity');
const Application = require('../models/Application');

// Search candidates with resumes and ATS scores - Optimized with aggregation
router.get('/search', auth, async (req, res) => {
  try {
    console.log('Candidates search endpoint hit with user:', req.user);
    
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const { 
      name, 
      skills, 
      location, 
      experienceLevel, 
      education,
      availability,
      sortBy = 'lastActive',
      sortOrder = 'desc',
      page = 1,
      limit = 20,
      search
    } = req.query;

    console.log('Search parameters:', { name, skills, location, search, page, limit });

    // Build match criteria - start with basic student filter
    const matchCriteria = { role: 'student' };

    // Add search filters only if they exist and are not empty
    if (search && search.trim()) {
      matchCriteria.$or = [
        { firstName: { $regex: search.trim(), $options: 'i' } },
        { lastName: { $regex: search.trim(), $options: 'i' } },
        { skills: { $in: [new RegExp(search.trim(), 'i')] } }
      ];
    }

    if (name && name.trim()) {
      matchCriteria.$or = [
        { firstName: { $regex: name.trim(), $options: 'i' } },
        { lastName: { $regex: name.trim(), $options: 'i' } }
      ];
    }

    if (location && location.trim()) {
      matchCriteria.location = { $regex: location.trim(), $options: 'i' };
    }

    if (availability && availability.trim() && availability !== 'all') {
      matchCriteria.availability = availability.trim();
    }

    console.log('Final match criteria:', JSON.stringify(matchCriteria, null, 2));

    // Build aggregation pipeline
    const pipeline = [
      { $match: matchCriteria },
      {
        $lookup: {
          from: 'resumes',
          localField: '_id',
          foreignField: 'user',
          as: 'resumes',
          pipeline: [
            { $sort: { lastUpdated: -1 } },
            { $limit: 1 }
          ]
        }
      },
      {
        $addFields: {
          resume: { $arrayElemAt: ['$resumes', 0] },
          profileCompleteness: {
            $multiply: [
              {
                $divide: [
                  {
                    $size: {
                      $filter: {
                        input: [
                          '$firstName', '$lastName', '$email', '$phone',
                          '$skills', '$education', '$bio'
                        ],
                        cond: { $ne: ['$$this', null] }
                      }
                    }
                  },
                  7
                ]
              },
              100
            ]
          }
        }
      }
    ];

    // Add skills filter if provided
    if (skills) {
      const skillsArray = Array.isArray(skills) ? skills : skills.split(',');
      if (skillsArray.length > 0) {
        pipeline.push({
          $match: {
            $or: [
              { skills: { $in: skillsArray.map(s => new RegExp(s.trim(), 'i')) } },
              { 'resume.skills': { $in: skillsArray.map(s => new RegExp(s.trim(), 'i')) } }
            ]
          }
        });
      }
    }

    // Add sorting
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;
    pipeline.push({ $sort: sortOptions });

    // Add pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: parseInt(limit) });

    // Remove password and unnecessary fields
    pipeline.push({
      $project: {
        password: 0,
        resumes: 0
      }
    });

    console.log('Executing aggregation pipeline...');
    const candidates = await User.aggregate(pipeline);
    console.log(`Found ${candidates.length} candidates`);

    // Get total count for pagination
    const countPipeline = [
      { $match: matchCriteria }
    ];
    
    // Add skills filter to count pipeline if provided
    if (skills) {
      const skillsArray = Array.isArray(skills) ? skills : skills.split(',');
      if (skillsArray.length > 0) {
        countPipeline.push({
          $lookup: {
            from: 'resumes',
            localField: '_id',
            foreignField: 'user',
            as: 'resumes'
          }
        });
        countPipeline.push({
          $addFields: {
            resume: { $arrayElemAt: ['$resumes', 0] }
          }
        });
        countPipeline.push({
          $match: {
            $or: [
              { skills: { $in: skillsArray.map(s => new RegExp(s.trim(), 'i')) } },
              { 'resume.skills': { $in: skillsArray.map(s => new RegExp(s.trim(), 'i')) } }
            ]
          }
        });
      }
    }
    
    countPipeline.push({ $count: 'total' });
    
    const countResult = await User.aggregate(countPipeline);
    const totalCount = countResult[0]?.total || 0;

    // Format response
    const formattedCandidates = candidates.map(candidate => ({
      ...candidate,
      id: candidate._id.toString(),
      resume: candidate.resume ? {
        id: candidate.resume._id.toString(),
        title: candidate.resume.title,
        atsScore: candidate.resume.atsScore || 0,
        skills: candidate.resume.skills || [],
        experience: candidate.resume.experience || [],
        education: candidate.resume.education || []
      } : null
    }));

    console.log('Sending response with', formattedCandidates.length, 'candidates');

    res.json({
      data: formattedCandidates,
      totalCount,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(totalCount / parseInt(limit))
    });
  } catch (error) {
    console.error('Error searching candidates:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get candidates for a specific opportunity with optimized ATS scores
router.get('/opportunity/:opportunityId', auth, async (req, res) => {
  try {
    const { opportunityId } = req.params;
    
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    console.log('Fetching candidates for opportunity:', opportunityId);

    // Find the opportunity with caching
    const opportunity = await Opportunity.findById(opportunityId).lean();
    if (!opportunity) {
      return res.status(404).json({ message: 'Opportunity not found' });
    }

    if (opportunity.organization.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    // Use aggregation for better performance
    const applicantsData = await Application.aggregate([
      { $match: { opportunity: new mongoose.Types.ObjectId(opportunityId) } },
      {
        $lookup: {
          from: 'users',
          localField: 'student',
          foreignField: '_id',
          as: 'student',
          pipeline: [
            { $project: { password: 0 } }
          ]
        }
      },
      {
        $lookup: {
          from: 'resumes',
          localField: 'student._id',
          foreignField: 'user',
          as: 'resume',
          pipeline: [
            { $sort: { lastUpdated: -1 } },
            { $limit: 1 }
          ]
        }
      },
      {
        $addFields: {
          student: { $arrayElemAt: ['$student', 0] },
          resume: { $arrayElemAt: ['$resume', 0] }
        }
      },
      { $sort: { appliedDate: -1 } }
    ]);

    console.log(`Found ${applicantsData.length} applicants`);

    // Calculate ATS scores efficiently
    const applicantsWithScores = await Promise.all(
      applicantsData.map(async (data) => {
        let atsScore = 0;
        
        if (data.resume) {
          atsScore = calculateATSScoreOptimized(data.resume, opportunity);
          
          // Update resume score in background (don't await)
          Resume.findByIdAndUpdate(data.resume._id, { atsScore }).catch(console.error);
        }

        return {
          application: {
            id: data._id.toString(),
            status: data.status,
            appliedDate: data.appliedDate,
            coverLetter: data.coverLetter
          },
          candidate: {
            ...data.student,
            id: data.student._id.toString(),
            resume: data.resume ? {
              id: data.resume._id.toString(),
              title: data.resume.title,
              atsScore: atsScore,
              skills: data.resume.skills || [],
              experience: data.resume.experience || [],
              education: data.resume.education || []
            } : null
          }
        };
      })
    );

    res.json({
      opportunity: {
        id: opportunity._id.toString(),
        title: opportunity.title,
        description: opportunity.description,
        skillsRequired: opportunity.skillsRequired || []
      },
      applicants: applicantsWithScores
    });
  } catch (error) {
    console.error('Error fetching opportunity candidates:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Optimized ATS score calculation
function calculateATSScoreOptimized(resume, opportunity) {
  let score = 0;
  let maxScore = 0;

  // Skills matching - optimized with sets
  const opportunitySkills = new Set((opportunity.skillsRequired || []).map(s => s.toLowerCase()));
  const resumeSkills = new Set((resume.skills || []).map(s => s.toLowerCase()));
  
  const skillMatches = [...opportunitySkills].filter(skill => resumeSkills.has(skill));
  const skillScore = (skillMatches.length / Math.max(opportunitySkills.size, 1)) * 40;
  score += skillScore;
  maxScore += 40;

  // Experience level matching
  if (opportunity.experienceLevel) {
    maxScore += 25;
    const resumeExperience = resume.experience || [];
    const totalYears = resumeExperience.reduce((total, exp) => {
      if (!exp.startDate) return total;
      const startDate = new Date(exp.startDate);
      const endDate = exp.current ? new Date() : new Date(exp.endDate || Date.now());
      const years = (endDate - startDate) / (1000 * 60 * 60 * 24 * 365);
      return total + Math.max(0, years);
    }, 0);

    const experienceMatch = getExperienceMatch(opportunity.experienceLevel, totalYears);
    score += experienceMatch * 25;
  }

  // Education matching
  if (resume.education && resume.education.length > 0) {
    maxScore += 15;
    score += 15;
  }

  // Profile completeness
  const requiredFields = ['personalInfo', 'skills', 'experience'];
  const completedFields = requiredFields.filter(field => {
    if (field === 'personalInfo') {
      return resume.personalInfo?.email && resume.personalInfo?.phone;
    }
    return resume[field] && resume[field].length > 0;
  });
  
  maxScore += 20;
  score += (completedFields.length / requiredFields.length) * 20;

  return Math.min(100, Math.round((score / maxScore) * 100));
}

function getExperienceMatch(requiredLevel, candidateYears) {
  const levelRanges = {
    'Entry-Level': [0, 2],
    'Intermediate': [2, 5],
    'Advanced': [5, Infinity]
  };

  const range = levelRanges[requiredLevel];
  if (!range) return 0.5;

  if (candidateYears >= range[0] && candidateYears <= range[1]) {
    return 1;
  } else if (candidateYears < range[0]) {
    return Math.max(0, 1 - (range[0] - candidateYears) * 0.2);
  } else {
    return Math.max(0, 1 - (candidateYears - range[1]) * 0.1);
  }
}

// Get candidate statistics with caching
router.get('/statistics', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    console.log('Fetching candidate statistics...');

    // Use aggregation for better performance
    const [
      totalResult,
      skillStats,
      experienceStats,
      locationStats
    ] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      User.aggregate([
        { $match: { role: 'student' } },
        { $unwind: '$skills' },
        { $group: { _id: '$skills', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ]),
      User.aggregate([
        { $match: { role: 'student' } },
        {
          $bucket: {
            groupBy: { $ifNull: ['$yearsOfExperience', 0] },
            boundaries: [0, 1, 3, 5, 10],
            default: '10+',
            output: { count: { $sum: 1 } }
          }
        }
      ]),
      User.aggregate([
        { $match: { role: 'student', location: { $exists: true, $ne: null } } },
        { $group: { _id: '$location', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
      ])
    ]);

    console.log('Statistics calculated successfully');

    res.json({
      totalCandidates: totalResult,
      bySkill: skillStats.map(item => ({
        skill: item._id,
        count: item.count
      })),
      byExperience: experienceStats.map(item => ({
        level: item._id === 0 ? '0-1 years' : 
               item._id === 1 ? '1-3 years' :
               item._id === 3 ? '3-5 years' :
               item._id === 5 ? '5-10 years' : '10+ years',
        count: item.count
      })),
      byLocation: locationStats.map(item => ({
        location: item._id,
        count: item.count
      }))
    });
  } catch (error) {
    console.error('Error fetching candidate statistics:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get candidate by ID with full profile - optimized
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('Fetching candidate by ID:', id);
    
    // Use aggregation for single query
    const candidateData = await User.aggregate([
      { $match: { _id: new mongoose.Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'resumes',
          localField: '_id',
          foreignField: 'user',
          as: 'resumes',
          pipeline: [{ $sort: { lastUpdated: -1 } }]
        }
      },
      {
        $lookup: {
          from: 'applications',
          localField: '_id',
          foreignField: 'student',
          as: 'applications',
          pipeline: [
            { $sort: { appliedDate: -1 } },
            {
              $lookup: {
                from: 'opportunities',
                localField: 'opportunity',
                foreignField: '_id',
                as: 'opportunity',
                pipeline: [
                  { $project: { title: 1, organization: 1 } }
                ]
              }
            },
            {
              $addFields: {
                opportunity: { $arrayElemAt: ['$opportunity', 0] }
              }
            }
          ]
        }
      },
      { $project: { password: 0 } }
    ]);

    if (!candidateData || candidateData.length === 0) {
      return res.status(404).json({ message: 'Candidate not found' });
    }

    const candidate = candidateData[0];

    res.json({
      ...candidate,
      id: candidate._id.toString(),
      resumes: candidate.resumes.map(resume => ({
        id: resume._id.toString(),
        title: resume.title,
        atsScore: resume.atsScore || 0,
        skills: resume.skills || [],
        experience: resume.experience || [],
        education: resume.education || [],
        lastUpdated: resume.lastUpdated
      })),
      applications: candidate.applications.map(app => ({
        id: app._id.toString(),
        opportunity: app.opportunity,
        status: app.status,
        appliedDate: app.appliedDate
      }))
    });
  } catch (error) {
    console.error('Error fetching candidate:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add a simple test route to check if students exist
router.get('/test-students', auth, async (req, res) => {
  try {
    if (req.user.role !== 'recruiter') {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    console.log('Testing student count...');
    
    const studentCount = await User.countDocuments({ role: 'student' });
    const students = await User.find({ role: 'student' })
      .select('firstName lastName email skills location availability')
      .limit(5);

    console.log(`Found ${studentCount} students total`);
    console.log('Sample students:', students);

    res.json({
      totalStudents: studentCount,
      sampleStudents: students.map(student => ({
        id: student._id,
        name: `${student.firstName} ${student.lastName}`,
        email: student.email,
        skills: student.skills || [],
        location: student.location,
        availability: student.availability
      }))
    });
  } catch (error) {
    console.error('Error testing students:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
