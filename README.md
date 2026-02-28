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

<img src="https://github.com/user-attachments/assets/1e592607-ede1-433c-9514-776c68bed349" width="800"/>


---

### 3. Protected Planner API Request

<img src="https://github.com/user-attachments/assets/e4502666-e6ca-4a4c-8415-45b5852fbd99" width="800"/>

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
