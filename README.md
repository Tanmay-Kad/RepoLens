# 🔭 RepoLens - AI-Powered Architecture Visualizer

RepoLens is a powerful developer productivity tool that ingests public GitHub repositories, performs static dependency analysis, and visualizes the codebase as an interactive, AI-assisted architecture graph. Understand foreign codebases in seconds, not days.

## ✨ Features

- **Interactive Architecture Graph**: Automatically maps out imports and dependencies into a fully navigable Cytoscape graph.
- **💥 Blast Radius Simulator**: Select any core file to simulate breaking changes. The graph will recursively trace and highlight the exact "blast radius" of downstream systems affected by your changes.
- **🤖 AI Semantic Search**: Ask Gemini AI natural language questions like *"Where is the auth logic?"* and it will automatically highlight the relevant files in the graph.
- **AI File Summaries**: Click on any node to get an instant AI-generated summary of its purpose, importance, and risks associated with modifying it.
- **🛡️ Automated Security Audit**: Automatically runs an `npm audit` on the repository's dependencies and displays a beautifully color-coded security vulnerability panel.
- **👻 Dead Code Detector**: Intelligently identifies "orphaned" or unused files that have zero incoming dependencies and are not standard entry points.
- **🔥 Highly Depended Files**: Instantly see which files represent architectural bottlenecks based on their dependency weight.

## 🛠️ Tech Stack

- **Frontend**: React + Vite + TailwindCSS + Cytoscape.js + Lucide React
- **Backend**: Node.js + Express + Mongoose + Madge (Graph Analysis)
- **AI**: Google Gemini Pro 1.5 API
- **Database**: MongoDB

## 📂 Project Structure

- `backend/` - Handles GitHub cloning, static graph extraction (Madge), MongoDB caching, and Gemini API proxying.
- `frontend/` - Handles the React application, Cytoscape graph rendering, and data visualization panels.

## 🚀 Setup & Installation

### 1) Install dependencies

Open two terminals for the frontend and backend.

```bash
# Terminal 1 (Backend)
cd backend
npm install

# Terminal 2 (Frontend)
cd frontend
npm install
```

### 2) Configure environment variables

Create a `backend/.env` file with the following variables:

```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/repolens
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3) Run the application

```bash
# Terminal 1 (Backend)
cd backend
npm run dev

# Terminal 2 (Frontend)
cd frontend
npm run dev
```

Open the Vite local server URL (usually `http://localhost:5173`) and paste any public GitHub repository URL!

## 🔗 Core API Endpoints

- `POST /api/analyze` - Clones a repository and initiates static analysis.
- `GET /api/graph/:repoId` - Fetches the generated dependency graph (nodes & edges).
- `GET /api/audit/:repoId` - Triggers an `npm audit` on the cloned repository.
- `POST /api/ai/summary` - Requests an AI-generated architectural summary of a specific file.
- `POST /api/ai/search` - Translates a natural language query into a list of relevant graph node IDs.

## ⚠️ Notes
- The backend clones repositories locally into a `cloned-repos/` folder for analysis.
- If you hit Gemini AI rate limits (`429 Too Many Requests`), wait a few seconds and try again. Free tier limits apply.
