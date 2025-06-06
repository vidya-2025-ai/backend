
# InternMatch Backend

This is the backend server for the InternMatch application built with Express.js and MongoDB.

## Setup Instructions

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file in the backend directory with the following variables:
   ```
   PORT=5000
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_jwt_secret_key
   ```

3. Start the development server:
   ```
   npm run dev
   ```

## API Routes

The backend provides the following API endpoints:

- `/api/auth` - Authentication routes (login, register)
- `/api/users` - User management routes
- `/api/applications` - Application management routes
- `/api/opportunities` - Opportunity listing and management
- `/api/certificates` - User certificates management
- `/api/mentorship` - Mentorship program routes
- `/api/skills` - Skills and assessments management
- `/api/calendar` - User calendar and events
- `/api/resume` - Resume builder and management
- `/api/ats` - ATS parameters and scoring

## Models

- User - For student, recruiter, and university accounts
- Application - For internship/job applications
- Opportunity - For job/internship listings
- Certificate - For student certifications
- Event - For calendar events
- Skill - For tracking skills and assessments
- Resume - For resume building
- ATSParameter - For ATS scoring criteria

Each model includes appropriate validation and relationships to other models.
