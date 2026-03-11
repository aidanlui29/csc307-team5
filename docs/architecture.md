# Architecture

## Monorepo Structure

This project is organized as a monorepo with separate frontend
and backend packages.

- `packages/react-frontend/`  
  React (Vite) frontend UI.

- `packages/backend/`  
  Express backend API with MongoDB (Mongoose) and JWT-based
  authentication.

## Module Breakdown

### Frontend (`packages/react-frontend/`)

- Handles UI rendering (daily/weekly planner views)
- Sends HTTP requests to backend endpoints
- Stores the JWT token on the client and includes it in
  protected requests

### Backend (`packages/backend/`)

- Provides REST API endpoints under `/api/*`
- Implements authentication using bcrypt + JWT
- Protects routes using `authenticateUser` middleware
- Stores and retrieves user-scoped data from MongoDB using
  `ownerId`
