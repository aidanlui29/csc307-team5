// backend.js
import dotenv from "dotenv";
// This forces dotenv to load the .env next to this file (bulletproof)
dotenv.config({ path: new URL("./.env", import.meta.url) });

import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { connectDb } from "./db.js";
import { User } from "./models/user.js";

const app = express();
app.use(express.json());

/**
 * JWT helper: create a signed token for the logged-in user.
 */
function generateAccessToken(user) {
  const secret = process.env.TOKEN_SECRET;
  if (!secret) {
    throw new Error("TOKEN_SECRET is missing. Check your packages/express-backend/.env");
  }

  return jwt.sign(
    { userId: user._id.toString(), email: user.email },
    secret,
    { expiresIn: "1d" }
  );
}

/**
 * Middleware: protect routes by requiring a valid Bearer token.
 */
function authenticateUser(req, res, next) {
  const authHeader = req.headers.authorization; // "Bearer <token>"
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).send("Unauthorized");

  jwt.verify(token, process.env.TOKEN_SECRET, (err, decoded) => {
    if (err || !decoded) return res.status(401).send("Unauthorized");
    req.user = decoded; // { userId, email, iat, exp }
    next();
  });
}

app.get("/api/health", (req, res) => res.json({ ok: true }));

/**
 * Protected example endpoint (useful for testing)
 */
app.get("/api/me", authenticateUser, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/planners", authenticateUser, async (req, res) => {
  // Later: fetch from DB with ownerId = req.user.userId
  res.json([]);
});

// SIGNUP
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send("Missing email or password");

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).send("Email already in use");

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email: normalizedEmail, passwordHash });

    const token = generateAccessToken(user);
    return res.status(201).json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
});

// LOGIN
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).send("Missing email or password");

    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).send("Invalid credentials");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).send("Invalid credentials");

    const token = generateAccessToken(user);
    return res.status(200).json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
});

const port = process.env.PORT || 3001;

async function start() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing. Check packages/express-backend/.env");
    }
    await connectDb();
    app.listen(port, () => console.log(`Server running on ${port}`));
  } catch (err) {
    console.error("Failed to start:", err);
    process.exit(1);
  }
}

start();