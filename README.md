# RepoNav - Repository Architecture Navigator

RepoNav is a MERN-based developer productivity tool that ingests a public GitHub repository URL, performs static dependency analysis, and visualizes the architecture as an interactive graph.

## Features

- Analyze public GitHub repositories (up to 200 filtered source files)
- Build file dependency graph from imports (`js/ts/jsx/tsx/py`)
- Identify `entry`, `core`, `utility`, and `external` nodes
- Compute risk scores and highlight high-impact files
- Recommend onboarding path for new developers
- Generate AI file summaries on click (Google Gemini API)
- Natural language search to highlight relevant subgraphs
- 24-hour graph caching in MongoDB

## Tech Stack

- Frontend: React + Vite + TailwindCSS + Zustand + react-force-graph-2d
- Backend: Node.js + Express + Mongoose + tree-sitter + Octokit + Gemini SDK
- Database: MongoDB

## Project Structure

- `server/` - API, ingestion, parsing, graph building, AI integration
- `client/` - Graph UI and interaction layer

## Setup

### 1) Install dependencies

```bash
cd server && npm install
cd ../client && npm install
```

### 2) Configure environment variables

Create `server/.env` and add:

```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/reponav
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-1.5-flash
GITHUB_TOKEN=ghp_... # optional
```

Create `client/.env` and add:

```env
VITE_API_URL=http://localhost:5000
```

### 3) Run application

Terminal 1:

```bash
cd server && npm run dev
```

Terminal 2:

```bash
cd client && npm run dev
```

Open the Vite URL and paste a repo URL such as:

`https://github.com/expressjs/express`

## API Endpoints

- `POST /api/analyze` `{ repoUrl }`
- `GET /api/graph/:repoId`
- `POST /api/query/summarize` `{ repoId, nodeId }` (SSE style response)
- `POST /api/query/search` `{ repoId, query }`

## Notes

- Private repos require `GITHUB_TOKEN`.
- If GitHub rate limit is hit, add `GITHUB_TOKEN` to increase limits.
- If Gemini fails, summary gracefully falls back to `"Summary unavailable"`.
