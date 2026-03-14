# ClockedIn

## Project Blurb

ClockedIn is a productivity planner designed for students who
struggle with procrastination and want to build consistent work
habits instead of relying on last-minute effort. Unlike
traditional calendar tools that focus on scheduling events,
ClockedIn promotes active productivity by attaching a timer to
each task, encouraging focused work sessions and intentional
time management. Users can create, edit, and prioritize tasks,
view daily and weekly planners, separate responsibilities into
different planners (e.g., school and work), and track their
progress over time. With features such as focus mode and task
time tracking, ClockedIn helps students better understand their
workload, improve discipline, and develop sustainable
productivity habits.

---

## Links

[Live Application](https://salmon-field-0381bb210.1.azurestaticapps.net)  

[Demo Video](<video-link>)

[GitHub Sprint Board](https://github.com/users/jeman618/projects/1)

[Figma UI Prototype](https://www.figma.com/design/Hc103T9Y2faSacd6bU2AbM/Planner?node-id=0-1&t=ORc1qbkaAyo2lqQT-1)
Last Updated: 2/15/2026

[UML Class Diagram](docs/uml-class-diagram.pdf) Last Updated:
3/10/2026

---

# Architecture

This project is organized as a monorepo with separate frontend
and backend packages.

### Monorepo Structure

- `packages/react-frontend/`  
  React (Vite) frontend UI.

- `packages/backend/`  
  Express backend API with MongoDB (Mongoose) and JWT-based
  authentication.

- `docs/`  
  Architecture documentation and design artifacts for this
  project.

## Development Environment Setup

### Prerequisites

- Node.js (v18+ recommended)
- npm
- MongoDB (local installation or MongoDB Atlas account)

### Setup

```bash
git clone <repo-url>
cd <repo-name>
npm install
```

If dependencies are not automatically installed for
sub-packages:

```bash
cd packages/backend
npm install

cd ../react-frontend
npm install
```

### Environment Variables

Create a `.env` file inside `packages/backend`:

```bash
PORT=5000
MONGO_URI=<your-mongodb-connection-string>
TOKEN_SECRET=<your-secret-key>
```

The frontend uses an `.env.production` file inside
`packages/react-frontend` with:

```bash
VITE_API_BASE_URL=<your-backend-url>
```

Do not commit any `.env` files containing secrets.

### Run the Application

```bash
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:5000

# Security & Access Control

- **Authentication:** Users authenticate with email + password
  (knowledge-based authentication). On login/signup, the backend
  issues a JSON Web Token (JWT).
- **Password Security:** Passwords are hashed using `bcrypt`
  before storage. Plain-text passwords are never stored.
- **Access Control:** Protected API routes require a valid JWT
  (`Authorization: Bearer <token>`). Planner and event data is
  scoped by the authenticated user ID (`ownerId`), preventing
  access to other users’ data.
- **Secrets Management:** Sensitive values (e.g., `MONGODB_URI`,
  `TOKEN_SECRET`) are stored in environment variables and are
  not committed to the repository.

## Sequence Diagrams

### 1. Sign-Up Flow

<img src="https://github.com/user-attachments/assets/9524759f-2808-4dc6-b92b-6cf60b90fb70" width="800"/>

---

### 2. Login Flow

<img src="https://github.com/user-attachments/assets/1e592607-ede1-433c-9514-776c68bed349" width="800"/>

---

### 3. Protected API Request (Planner Example)

<img src="https://github.com/user-attachments/assets/e4502666-e6ca-4a4c-8415-45b5852fbd99" width="800"/>

---
