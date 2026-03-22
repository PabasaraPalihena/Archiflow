<h1 align="center">
  <br>
  ArchiFlow
  <br>
</h1>

<h4 align="center">Where Ideas Flow Into Intelligent Architecture</h4>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white&style=flat-square"/>
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white&style=flat-square"/>
  <img alt="Vite" src="https://img.shields.io/badge/Vite-7-646CFF?logo=vite&logoColor=white&style=flat-square"/>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-Express-339933?logo=node.js&logoColor=white&style=flat-square"/>
  <img alt="MongoDB" src="https://img.shields.io/badge/MongoDB-Mongoose-47A248?logo=mongodb&logoColor=white&style=flat-square"/>
  <img alt="OpenAI" src="https://img.shields.io/badge/OpenAI-API-412991?logo=openai&logoColor=white&style=flat-square"/>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#features">Features</a> •
  <a href="#technology-stack">Technology Stack</a> •
  <a href="#project-structure">Project Structure</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#environment-variables">Environment Variables</a> •
  <a href="#api-reference">API Reference</a>
</p>

## Overview

**ArchiFlow** is an interactive system architecture editor that enables users to design, visualize, and document system architectures based on the **WAM (Webcomposition Architecture Model)**. The platform allows both technical and non-technical stakeholders to collaboratively explore system structures through visual modeling and descriptive architecture elements. Each WAM element can include human-readable descriptions, making complex architectures easier to understand and communicate.

## Features

| Feature                     | Description                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------ |
| **Visual Canvas Editor**    | Drag-and-drop WAM element palette with a React Flow–powered canvas                   |
| **Smart Edge Manipulation** | Custom editable edges with waypoints, handle reassignment, and animated connections  |
| **AI Integration**          | OpenAI-powered element descriptions, architecture explanations, and a chat assistant |
| **Cost Estimation**         | Automatic hosting/infrastructure cost estimates based on diagram composition         |
| **Authentication**          | JWT-based login, registration, password reset via OTP email                          |
| **Diagram Persistence**     | Save, load, and manage multiple architecture diagrams stored in MongoDB              |
| **Validation**              | Model validation with error and warning feedback                                     |
| **Voice Prompt**            | Voice-input support for AI prompt interactions                                       |
| **Integrations**            | Third-party integration management and subscription handling                         |
| **Responsive UI**           | Fully responsive layout from mobile to ultra-wide screens                            |

## Technology Stack

### Frontend

| Technology                                                   | Version | Purpose                            |
| ------------------------------------------------------------ | ------- | ---------------------------------- |
| [React](https://react.dev/)                                  | 19      | UI component library               |
| [TypeScript](https://www.typescriptlang.org/)                | 5.9     | Type-safe JavaScript               |
| [Vite](https://vitejs.dev/)                                  | 7       | Build tool & dev server            |
| [React Flow](https://reactflow.dev/)                         | 11      | Interactive graph/canvas rendering |
| [React Router DOM](https://reactrouter.com/)                 | 7       | Client-side routing                |
| [Axios](https://axios-http.com/)                             | 1.x     | HTTP client                        |
| [Lucide React](https://lucide.dev/)                          | 0.56    | Icon library                       |
| [React Hot Toast](https://react-hot-toast.com/)              | 2.x     | Toast notifications                |
| [React Markdown](https://github.com/remarkjs/react-markdown) | 10      | Markdown rendering for AI output   |
| [html-to-image](https://github.com/bubkoo/html-to-image)     | 1.x     | Diagram export to PNG              |

### Backend

| Technology                                                | Version | Purpose                   |
| --------------------------------------------------------- | ------- | ------------------------- |
| [Node.js](https://nodejs.org/)                            | LTS     | JavaScript runtime        |
| [Express](https://expressjs.com/)                         | 5       | Web application framework |
| [MongoDB](https://www.mongodb.com/)                       | Atlas   | NoSQL database            |
| [Mongoose](https://mongoosejs.com/)                       | 9       | MongoDB ODM               |
| [JSON Web Token](https://jwt.io/)                         | 9       | Authentication tokens     |
| [bcryptjs](https://github.com/dcodeIO/bcrypt.js)          | 3       | Password hashing          |
| [Nodemailer](https://nodemailer.com/)                     | 7       | OTP/transactional email   |
| [OpenAI SDK](https://platform.openai.com/docs/libraries)  | 6       | GPT-powered AI features   |
| [node-cron](https://github.com/node-cron/node-cron)       | 4       | Scheduled background jobs |
| [express-validator](https://express-validator.github.io/) | 7       | Input validation          |

### Dev & Testing

| Technology                                                              | Purpose                              |
| ----------------------------------------------------------------------- | ------------------------------------ |
| [Nodemon](https://nodemon.io/)                                          | Auto-restart backend on file changes |
| [Jest](https://jestjs.io/)                                              | Unit testing framework               |
| [Supertest](https://github.com/ladjs/supertest)                         | HTTP integration testing             |
| [MongoDB Memory Server](https://github.com/nodkz/mongodb-memory-server) | In-memory MongoDB for tests          |
| [Vitest](https://vitest.dev/)                                           | Frontend unit testing                |
| [ESLint](https://eslint.org/)                                           | Code linting                         |

## Project Structure

```
ArchiFlow-New/
│
├── backend/                        # Node.js + Express REST API
│   ├── config/                     # Database & app configuration
│   ├── common/                     # Shared utilities (email, helpers)
│   ├── jobs/                       # Scheduled cron jobs
│   ├── middleware/                 # Auth middleware (JWT verification)
│   ├── models/                     # Mongoose data models
│   │   ├── User.js                 # User schema (auth, subscription)
│   │   ├── Diagram.js              # Architecture diagram schema
│   │   ├── ai/                     # AI-related models
│   │   └── wam/                    # WAM element models
│   ├── routes/                     # Express route handlers
│   │   ├── auth.js                 # Register, login, OTP reset
│   │   ├── diagrams.js             # Diagram CRUD operations
│   │   ├── integrations.js         # Third-party integrations
│   │   ├── costEstimate.js         # Cost estimation engine
│   │   └── subscription.js         # Subscription management
│   ├── tests/                      # Jest test suites
│   ├── server.js                   # App entry point
│   └── package.json
│
├── frontend/                       # React + TypeScript SPA
│   └── src/
│       ├── assets/                 # Static images & illustrations
│       ├── components/
│       │   ├── Canvas/             # Core diagram editor
│       │   │   ├── MainCanvas.tsx  # Main React Flow canvas
│       │   │   ├── EditorLayout.tsx
│       │   │   ├── CanvasToolbar.tsx
│       │   │   ├── EditableEdge.tsx # Custom edge w/ waypoints
│       │   │   └── ValidationPanel.tsx
│       │   ├── Palette/            # WAM element palette & nodes
│       │   │   ├── WamPalette.tsx
│       │   │   ├── WamNode.tsx
│       │   │   ├── RelationshipNode.tsx
│       │   │   └── PropertyMngPanel.tsx
│       │   ├── chat/               # AI chat assistant
│       │   ├── VoicePrompt/        # Voice input component
│       │   ├── CostEstimate/       # Cost estimation UI
│       │   ├── Integrations/       # Integration management
│       │   ├── Subscription/       # Subscription & billing UI
│       │   ├── Settings/           # User settings
│       │   ├── FAQ/                # Help & FAQ page
│       │   ├── ConfirmModal/       # Reusable confirm dialog
│       │   ├── Common/             # Shared UI components
│       │   └── User/               # Auth pages
│       │       ├── Login.tsx
│       │       └── ForgotPassword.tsx
│       ├── context/                # React Context (AuthContext)
│       ├── services/               # API service layer
│       ├── utils/                  # Utility functions
│       ├── App.tsx                 # Root app & routing
│       └── main.tsx                # Vite entry point
│
├── .gitignore
├── .mailmap
└── README.md
```

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/) ≥ 18.x
- [npm](https://www.npmjs.com/) ≥ 9.x
- A [MongoDB Atlas](https://www.mongodb.com/atlas) account (free tier works)
- An [OpenAI API](https://platform.openai.com/) key

### 1. Clone the Repository

```bash
git clone https://gitlab.hrz.tu-chemnitz.de/vsr/edu/planspiel/ws2526/marxdev.git
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file inside the `backend/` folder (see [Environment Variables](#environment-variables)):

```bash
cp .env.example .env   # or create it manually
```

Start the backend development server:

```bash
npm run dev
```

> The backend will start on `http://localhost:<PORT>` as defined in your `.env`.

### 3. Frontend Setup

Open a **new terminal**, then:

```bash
cd frontend
npm install
npm run dev
```

> The frontend will be available at **http://localhost:5173**

### 4. Running Tests

**Backend tests (Jest):**

```bash
cd backend
npx jest
```

**Frontend tests (Vitest):**

```bash
cd frontend
npx vitest
```

## Environment Variables

Create a `.env` file in the `backend/` directory with the following variables:

```env
# Server
PORT=5000

# MongoDB
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/<dbname>?retryWrites=true&w=majority

# JWT Authentication
JWT_SECRET=your_jwt_secret_key

# OpenAI
OPENAI_API_KEY=sk-...

# Email (Nodemailer — e.g. Gmail SMTP)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Frontend URL (for CORS)
CLIENT_URL=http://localhost:5173
```

## License

This project is developed for academic purposes. All rights reserved © 2025–2026.

## Developed By

<p align="center">
  Built with ❤️ by the <strong>MarxDev Development Team</strong>
  <br/><br/>
  <a href="https://marxdev.vercel.app/">🌐 marxdev.vercel.app</a> &nbsp;•&nbsp;
  <a href="https://linkedin.com/company/marx-dev/">💼 LinkedIn</a>
</p>
