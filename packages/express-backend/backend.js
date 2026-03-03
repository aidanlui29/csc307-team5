// packages/express-backend/server.js
import dotenv from "dotenv";
// bulletproof: load .env next to this file
dotenv.config({ path: new URL("./.env", import.meta.url) });

import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import { connectDb } from "./db.js";
import { User } from "./models/user.js";

const app = express();
app.use(express.json());

/* =========================
   JWT helpers + middleware
   ========================= */

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

/* =========================
   Health / debug
   ========================= */

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/me", authenticateUser, (req, res) => {
  res.json({ user: req.user });
});

/* =========================
   AUTH
   ========================= */

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

let planners = []; // { id, ownerId, name, color, description }

function makeId() {
  return globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : String(Date.now());
}

app.get("/api/planners", authenticateUser, async (req, res) => {
  const ownerId = req.user.userId;
  res.json(planners.filter((p) => p.ownerId === ownerId));
});

app.post("/api/planners", authenticateUser, async (req, res) => {
  const { name, color, description } = req.body;

  if (!name || !String(name).trim()) {
    return res.status(400).send("Planner name is required");
  }

  const created = {
    id: makeId(),
    ownerId: req.user.userId,
    name: String(name).trim(),
    color: color || "#9ca3af",
    description: description ? String(description) : "",
  };

  planners.unshift(created);
  return res.status(201).json(created);
});

app.put("/api/planners/:id", authenticateUser, async (req, res) => {
  const { id } = req.params;
  const { name, color, description } = req.body;

  const idx = planners.findIndex((p) => p.id === id && p.ownerId === req.user.userId);
  if (idx === -1) return res.status(404).send("Planner not found");

  const updated = {
    ...planners[idx],
    name: name !== undefined ? String(name).trim() : planners[idx].name,
    color: color !== undefined ? color : planners[idx].color,
    description: description !== undefined ? String(description) : planners[idx].description,
  };

  if (!updated.name) return res.status(400).send("Planner name is required");

  planners[idx] = updated;
  return res.json(updated);
});

app.delete("/api/planners/:id", authenticateUser, async (req, res) => {
  const { id } = req.params;

  const before = planners.length;
  planners = planners.filter((p) => !(p.id === id && p.ownerId === req.user.userId));

  if (planners.length === before) return res.status(404).send("Planner not found");
  return res.status(204).send();
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