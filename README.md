We are the Lab Rats! This is built off of IE4: Database Integration.



# TE5 – Authentication & Access Control
This project implements JWT-based authentication using bcrypt for password hashing and Express middleware for protecting backend routes.

After successful login or signup:
- A JWT token is generated
- The token is stored on the client
- Protected routes verify the token before accessing data
- Invalid or missing tokens return 401 Unauthorized

---

## Sequence Diagrams

### 1. Sign-Up Flow

<img src="https://github.com/user-attachments/assets/9524759f-2808-4dc6-b92b-6cf60b90fb70" width="800"/>

---

### 2. Login Flow

<img src="https://github.com/user-attachments/assets/fe4cdd4b-e378-4e2e-9e9d-6368083eb074" width="800"/>

---

### 3. Protected Planner API Request

<img src="https://github.com/user-attachments/assets/f9c8ec96-905f-4529-a235-380274638c83" width="800"/>

---

## Security Behavior

- **Sign-Up**
  - 400 Bad Request (invalid input)
  - 409 Conflict (email already exists)

- **Login**
  - 401 Unauthorized (user not found)
  - 401 Unauthorized (incorrect password)

- **Protected Routes**
  - 401 Unauthorized (missing token)
  - 401 Unauthorized (invalid or expired token)
