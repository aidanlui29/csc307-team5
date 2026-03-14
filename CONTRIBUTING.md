# Contributing to ClockedIn

This document explains how developers should set up the project
and follow the coding style used in this repository.

## Project Structure

ClockedIn is organized as a monorepo.

- `packages/react-frontend/` — React (Vite) frontend
- `packages/backend/` — Express backend API with MongoDB
- `docs/` — UML diagrams and documentation

The main frontend routing is defined in `App.jsx`, and
pages/components are located inside `packages/react-frontend/`.

## Development Setup

### Prerequisites

- Node.js (v18+ recommended)
- npm
- MongoDB (local or MongoDB Atlas)

### Installation

Clone the repository and install dependencies:

```bash
git clone <repo-url>
cd <repo-name>
npm install
```

If needed:

```bash
cd packages/backend
npm install

cd ../react-frontend
npm install
```

## Environment Variables

Create `.env` in `packages/backend`:

```env
PORT=5000
MONGO_URI=<your-mongodb-connection-string>
TOKEN_SECRET=<your-secret-key>
```

Create `.env.production` in `packages/react-frontend`:

```env
VITE_API_BASE_URL=<your-backend-url>
```

Do not commit `.env` files.

## Running the Application

```bash
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:5000

## Coding Style

- Use clear variable and function names
- Keep functions small and focused
- Remove unused imports or commented code
- Use React functional components and hooks
- Follow the routing structure defined in `App.jsx`

## Git Workflow

1. Pull latest changes from `main`
2. Create a feature branch
3. Make and test changes
4. Commit with clear messages
5. Open a pull request before merging
