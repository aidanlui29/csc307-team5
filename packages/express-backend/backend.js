import dotenv from "dotenv";
// This forces dotenv to load the .env next to this file (bulletproof)
dotenv.config({ path: new URL("./.env", import.meta.url) });

import express from "express";
import bcrypt from "bcrypt";
import { connectDb } from "./db.js";
import { User } from "./models/user.js";

const app = express();
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ ok: true }));

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
    res.status(201).json({ id: user._id.toString(), email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
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

    // For now: just confirm success (we'll add JWT next)
    res.json({ ok: true, id: user._id.toString(), email: user.email });
  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
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