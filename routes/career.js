const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// Debug middleware for career routes
router.use((req, res, next) => {
  console.log(`Career API called: ${req.method} ${req.path}`);
  next();
});

// Get career skills
router.get('/skills', auth, async (req, res) => {
  try {
    console.log('Fetching career skills for user:', req.user.id);
    const careerSkills = [
      {
        id: '1',
        name: 'Technical Skills',
        skills: [
          { id: 'ts1', name: 'Web Development', level: 0 },
          { id: 'ts2', name: 'Mobile Development', level: 0 },
          { id: 'ts3', name: 'Data Science', level: 0 },
          { id: 'ts4', name: 'DevOps', level: 0 },
          { id: 'ts5', name: 'Cloud Computing', level: 0 }
        ]
      },
      {
        id: '2',
        name: 'Soft Skills',
        skills: [
          { id: 'ss1', name: 'Communication', level: 0 },
          { id: 'ss2', name: 'Teamwork', level: 0 },
          { id: 'ss3', name: 'Problem Solving', level: 0 },
          { id: 'ss4', name: 'Critical Thinking', level: 0 },
          { id: 'ss5', name: 'Leadership', level: 0 }
        ]
      }
    ];
    
    res.json(careerSkills);
  } catch (error) {
    console.error('Error in /skills:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get career paths
router.get('/paths', auth, async (req, res) => {
  try {
    console.log('Fetching career paths for user:', req.user.id);
    const careerData = {
      careerPaths: [
        { id: 1, name: "Frontend Development", progress: 65, level: "Intermediate" },
        { id: 2, name: "UX/UI Design", progress: 42, level: "Beginner" },
        { id: 3, name: "Data Analysis", progress: 28, level: "Beginner" }
      ],
      milestones: [
        { id: 1, name: "HTML & CSS Mastery", completed: true, pathId: 1 },
        { id: 2, name: "JavaScript Fundamentals", completed: true, pathId: 1 },
        { id: 3, name: "React Basics", completed: true, pathId: 1 },
        { id: 4, name: "Redux & State Management", completed: false, pathId: 1 },
        { id: 5, name: "Advanced React Patterns", completed: false, pathId: 1 },
        { id: 6, name: "UI Design Principles", completed: true, pathId: 2 },
        { id: 7, name: "User Research Methods", completed: true, pathId: 2 },
        { id: 8, name: "Wireframing & Prototyping", completed: false, pathId: 2 },
        { id: 9, name: "Figma Advanced Techniques", completed: false, pathId: 2 },
        { id: 10, name: "Excel & SQL Basics", completed: true, pathId: 3 },
        { id: 11, name: "Data Visualization", completed: false, pathId: 3 },
        { id: 12, name: "Python for Data Analysis", completed: false, pathId: 3 }
      ],
      interests: ["Technology", "Design", "Data Analysis"]
    };
    
    res.json(careerData);
  } catch (error) {
    console.error('Error in /paths:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recommended jobs
router.get('/recommended-jobs', auth, async (req, res) => {
  try {
    console.log('Fetching recommended jobs for user:', req.user.id);
    const recommendedJobs = [
      {
        id: 1,
        title: "Frontend Developer Intern",
        company: "TechCorp",
        match: 92,
        skills: ["React", "JavaScript", "CSS"]
      },
      {
        id: 2,
        title: "UI/UX Design Assistant",
        company: "DesignStudio",
        match: 85,
        skills: ["Figma", "UI Design", "Wireframing"]
      },
      {
        id: 3,
        title: "Junior Data Analyst",
        company: "DataInsights",
        match: 78,
        skills: ["Excel", "SQL", "Data Visualization"]
      }
    ];
    
    res.json(recommendedJobs);
  } catch (error) {
    console.error('Error in /recommended-jobs:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get learning paths
router.get('/learning-paths', auth, async (req, res) => {
  try {
    const learningPaths = [
      { id: 1, name: "React Development Bootcamp", progress: 45, modules: 12 },
      { id: 2, name: "UI/UX Design Fundamentals", progress: 60, modules: 8 },
      { id: 3, name: "Data Science with Python", progress: 20, modules: 15 }
    ];
    
    res.json(learningPaths);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get projects
router.get('/projects', auth, async (req, res) => {
  try {
    const projects = [
      {
        id: 1,
        name: "E-commerce Website",
        tags: ["React", "Node.js", "MongoDB"],
        deadline: "2024-12-15"
      },
      {
        id: 2,
        name: "Mobile App Design",
        tags: ["Figma", "UI/UX", "Prototyping"],
        deadline: "2024-11-30"
      },
      {
        id: 3,
        name: "Data Analysis Dashboard",
        tags: ["Python", "Pandas", "Visualization"],
        deadline: "2024-12-10"
      }
    ];
    
    res.json(projects);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recommendations
router.get('/recommendations', auth, async (req, res) => {
  try {
    const recommendations = {
      careerBased: [
        { id: 1, title: "Advanced React Patterns", description: "Learn advanced React concepts for better code organization" },
        { id: 2, title: "TypeScript Fundamentals", description: "Add type safety to your JavaScript projects" }
      ],
      trending: [
        { id: 3, title: "AI/ML Basics", description: "Understanding artificial intelligence and machine learning" },
        { id: 4, title: "Cloud Computing", description: "Learn AWS/Azure fundamentals for modern applications" }
      ]
    };
    
    res.json(recommendations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Generate career roadmap based on desired role (ML model simulation)
router.post('/generate-roadmap', auth, async (req, res) => {
  try {
    const { desiredRole, currentSkills = [], experience = "beginner" } = req.body;
    console.log('Generating roadmap for:', { desiredRole, currentSkills, experience, userId: req.user.id });
    
    // Simulate ML model response based on desired role
    const roadmapTemplates = {
      "Software Engineer": {
        careerPaths: [
          { id: 1, name: "Frontend Development", progress: 0, level: "Beginner" },
          { id: 2, name: "Backend Development", progress: 0, level: "Beginner" },
          { id: 3, name: "System Design", progress: 0, level: "Beginner" }
        ],
        milestones: [
          { id: 1, name: "Programming Fundamentals", completed: false, pathId: 1, timeframe: "1-2 months" },
          { id: 2, name: "HTML, CSS, JavaScript", completed: false, pathId: 1, timeframe: "2-3 months" },
          { id: 3, name: "React/Angular/Vue", completed: false, pathId: 1, timeframe: "3-4 months" },
          { id: 4, name: "Node.js/Python/Java", completed: false, pathId: 2, timeframe: "4-6 months" },
          { id: 5, name: "Database Design", completed: false, pathId: 2, timeframe: "5-7 months" },
          { id: 6, name: "System Architecture", completed: false, pathId: 3, timeframe: "8-12 months" }
        ]
      },
      "Data Scientist": {
        careerPaths: [
          { id: 1, name: "Programming & Statistics", progress: 0, level: "Beginner" },
          { id: 2, name: "Machine Learning", progress: 0, level: "Beginner" },
          { id: 3, name: "Data Engineering", progress: 0, level: "Beginner" }
        ],
        milestones: [
          { id: 1, name: "Python Programming", completed: false, pathId: 1, timeframe: "1-2 months" },
          { id: 2, name: "Statistics & Probability", completed: false, pathId: 1, timeframe: "2-3 months" },
          { id: 3, name: "Pandas & NumPy", completed: false, pathId: 1, timeframe: "3-4 months" },
          { id: 4, name: "Machine Learning Algorithms", completed: false, pathId: 2, timeframe: "4-6 months" },
          { id: 5, name: "Deep Learning", completed: false, pathId: 2, timeframe: "6-8 months" },
          { id: 6, name: "Data Pipeline Design", completed: false, pathId: 3, timeframe: "8-10 months" }
        ]
      },
      "UX Designer": {
        careerPaths: [
          { id: 1, name: "Design Principles", progress: 0, level: "Beginner" },
          { id: 2, name: "User Research", progress: 0, level: "Beginner" },
          { id: 3, name: "Prototyping", progress: 0, level: "Beginner" }
        ],
        milestones: [
          { id: 1, name: "Design Thinking", completed: false, pathId: 1, timeframe: "1-2 months" },
          { id: 2, name: "Visual Design Principles", completed: false, pathId: 1, timeframe: "2-3 months" },
          { id: 3, name: "User Research Methods", completed: false, pathId: 2, timeframe: "3-4 months" },
          { id: 4, name: "Wireframing & Mockups", completed: false, pathId: 3, timeframe: "4-5 months" },
          { id: 5, name: "Figma/Sketch Mastery", completed: false, pathId: 3, timeframe: "5-6 months" },
          { id: 6, name: "Usability Testing", completed: false, pathId: 2, timeframe: "6-8 months" }
        ]
      },
      "Product Manager": {
        careerPaths: [
          { id: 1, name: "Product Strategy", progress: 0, level: "Beginner" },
          { id: 2, name: "Market Research", progress: 0, level: "Beginner" },
          { id: 3, name: "Project Management", progress: 0, level: "Beginner" }
        ],
        milestones: [
          { id: 1, name: "Product Management Fundamentals", completed: false, pathId: 1, timeframe: "1-2 months" },
          { id: 2, name: "Market Analysis", completed: false, pathId: 2, timeframe: "2-3 months" },
          { id: 3, name: "User Story Writing", completed: false, pathId: 1, timeframe: "3-4 months" },
          { id: 4, name: "Agile Methodologies", completed: false, pathId: 3, timeframe: "4-5 months" },
          { id: 5, name: "Product Metrics & Analytics", completed: false, pathId: 1, timeframe: "5-6 months" },
          { id: 6, name: "Roadmap Planning", completed: false, pathId: 3, timeframe: "6-8 months" }
        ]
      }
    };
    
    const roadmap = roadmapTemplates[desiredRole] || roadmapTemplates["Software Engineer"];
    
    const result = {
      desiredRole,
      estimatedTimeframe: "6-12 months",
      ...roadmap,
      recommendedResources: [
        "Online courses and tutorials",
        "Practice projects",
        "Open source contributions",
        "Professional networking",
        "Industry certifications"
      ]
    };
    
    console.log('Generated roadmap successfully for role:', desiredRole);
    res.json(result);
  } catch (error) {
    console.error('Error in /generate-roadmap:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get recommended skills based on student profile
router.get('/recommended-skills', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const recommendedSkills = [
      { id: 'rs1', name: 'React.js', category: 'Technical', priority: 'High' },
      { id: 'rs2', name: 'SQL', category: 'Technical', priority: 'Medium' },
      { id: 'rs3', name: 'Project Management', category: 'Soft Skills', priority: 'Medium' },
      { id: 'rs4', name: 'Public Speaking', category: 'Soft Skills', priority: 'Low' }
    ];
    
    res.json(recommendedSkills);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
