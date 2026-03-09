import dotenv from "dotenv";
dotenv.config(); // Local .env if present; Azure uses App Settings env vars

import express from "express";
import cors from "cors";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

import { connectDb } from "./db.js";
import { User } from "./models/user.js";
import { Planner } from "./models/planner.js";
import { Event } from "./models/event.js";

const app = express();

app.use(express.json());

/* =========================
   CORS (local now, deployed later)
   ========================= */

const allowedOrigins = [
  "http://localhost:5173",
  "https://salmon-field-0381bb210.1.azurestaticapps.net"
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true
  })
);

/* =========================
   JWT helpers + middleware
   ========================= */

function generateAccessToken(user) {
  const secret = process.env.TOKEN_SECRET;
  if (!secret) {
    throw new Error(
      "TOKEN_SECRET is missing. Set it in Azure Environment variables (App settings) or local .env"
    );
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
   Helpers
   ========================= */

function isYmd(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function toMinuteInt(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return null;
  const i = Math.floor(x);
  if (i < 0 || i > 1440) return null;
  return i;
}

function normalizePlanner(doc) {
  return {
    id: doc._id.toString(),
    ownerId: doc.ownerId.toString(),
    name: doc.name,
    color: doc.color,
    description: doc.description || ""
  };
}

function normalizeEvent(doc) {
  return {
    id: doc._id.toString(),
    plannerId: doc.plannerId.toString(),
    ownerId: doc.ownerId.toString(),
    kind: doc.kind,
    date: doc.date,
    title: doc.title,
    desc: doc.desc || "",
    startMin: doc.startMin,
    endMin: doc.endMin,
    priority: doc.priority ?? "medium",
    completed: !!doc.completed
  };
}

function normalizePriority(p) {
  const v = String(p ?? "").toLowerCase();
  if (!["low", "medium", "high"].includes(v)) return null;
  return v;
}

/* =========================
   WEEKLY REFLECTION (Mongo)
   ========================= */

const WeeklyReflectionSchema = new mongoose.Schema(
  {
    ownerId: { type: String, required: true }, // keep as String (matches rest of app)
    weekStart: { type: String, required: true }, // "YYYY-MM-DD"
    text: { type: String, default: "" }
  },
  { timestamps: true }
);

WeeklyReflectionSchema.index({ ownerId: 1, weekStart: 1 }, { unique: true });

const WeeklyReflection =
  mongoose.models.WeeklyReflection ||
  mongoose.model("WeeklyReflection", WeeklyReflectionSchema);

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

app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).send("Missing email or password");

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) return res.status(409).send("Email already in use");

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: normalizedEmail,
      passwordHash
    });

    const token = generateAccessToken(user);
    return res.status(201).json({ token });
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).send("Missing email or password");

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

/* =========================
   PLANNERS (Mongo)
   ========================= */

app.get("/api/planners", authenticateUser, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const docs = await Planner.find({ ownerId }).sort({ createdAt: -1 });
    return res.json(docs.map(normalizePlanner));
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
});

app.post("/api/planners", authenticateUser, async (req, res) => {
  try {
    const { name, color, description } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).send("Planner name is required");
    }

    const created = await Planner.create({
      ownerId: req.user.userId,
      name: String(name).trim(),
      color: color || "#9ca3af",
      description: description ? String(description) : ""
    });

    return res.status(201).json(normalizePlanner(created));
  } catch (err) {
    console.error(err);
    return res.status(500).send("Server error");
  }
});

app.put("/api/planners/:id", authenticateUser, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { id } = req.params;
    const { name, color, description } = req.body;

    const update = {};
    if (name !== undefined) {
      const cleaned = String(name).trim();
      if (!cleaned) return res.status(400).send("Planner name is required");
      update.name = cleaned;
    }
    if (color !== undefined) update.color = color;
    if (description !== undefined) update.description = String(description);

    const updated = await Planner.findOneAndUpdate(
      { _id: id, ownerId },
      { $set: update },
      { returnDocument: "after" } // ✅ replaces deprecated { new: true }
    );

    if (!updated) return res.status(404).send("Planner not found");
    return res.json(normalizePlanner(updated));
  } catch (err) {
    console.error(err);
    return res.status(400).send("Invalid planner id");
  }
});

app.delete("/api/planners/:id", authenticateUser, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { id } = req.params;

    const deleted = await Planner.findOneAndDelete({ _id: id, ownerId });
    if (!deleted) return res.status(404).send("Planner not found");

    await Event.deleteMany({ ownerId, plannerId: id });

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(400).send("Invalid planner id");
  }
});

/* =========================
   EVENTS (Mongo)
   ========================= */

app.get("/api/planners/:plannerId/events", authenticateUser, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { plannerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(plannerId)) {
      return res.status(404).send("Planner not found");
    }

    const planner = await Planner.findOne({ _id: plannerId, ownerId }).select("_id");
    if (!planner) return res.status(404).send("Planner not found");

    const { from, to } = req.query;
    const query = { ownerId, plannerId };

    if (from || to) {
      if (from && !isYmd(from)) return res.status(400).send("Invalid from date");
      if (to && !isYmd(to)) return res.status(400).send("Invalid to date");
      query.date = {};
      if (from) query.date.$gte = from;
      if (to) query.date.$lte = to;
    }

    const docs = await Event.find(query).sort({ date: 1, startMin: 1 });
    return res.json(docs.map(normalizeEvent));
  } catch (err) {
    console.error(err);
    return res.status(400).send("Invalid request");
  }
});

app.post("/api/planners/:plannerId/events", authenticateUser, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { plannerId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(plannerId)) {
      return res.status(404).send("Planner not found");
    }

    const planner = await Planner.findOne({ _id: plannerId, ownerId }).select("_id");
    if (!planner) return res.status(404).send("Planner not found");

    const { kind, date, title, desc, startMin, endMin, priority, completed } = req.body || {};

    if (kind !== "task" && kind !== "schedule") return res.status(400).send("Invalid kind");
    if (!isYmd(date)) return res.status(400).send("Invalid date");

    const t = String(title ?? "").trim();
    if (!t) return res.status(400).send("Title is required");

    const s = toMinuteInt(startMin);
    const e = toMinuteInt(endMin);
    if (s === null || e === null) return res.status(400).send("Invalid time range");
    if (e <= s) return res.status(400).send("End time must be after start time");

    let pr = "medium";
    let done = false;

    if (kind === "task") {
      if (priority !== undefined) {
        const p = normalizePriority(priority);
        if (!p) return res.status(400).send("Invalid priority");
        pr = p;
      }
      if (completed !== undefined) done = !!completed;
    }

    const created = await Event.create({
      ownerId,
      plannerId,
      kind,
      date,
      title: t,
      desc: desc ? String(desc) : "",
      startMin: s,
      endMin: e,
      priority: pr,
      completed: done
    });

    return res.status(201).json(normalizeEvent(created));
  } catch (err) {
    console.error(err);
    return res.status(400).send("Invalid request");
  }
});

app.put("/api/events/:id", authenticateUser, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { id } = req.params;

    const existing = await Event.findOne({ _id: id, ownerId });
    if (!existing) return res.status(404).send("Event not found");

    const update = {};

    if (req.body?.kind !== undefined) {
      if (req.body.kind !== "task" && req.body.kind !== "schedule") {
        return res.status(400).send("Invalid kind");
      }
      update.kind = req.body.kind;
    }

    if (req.body?.date !== undefined) {
      if (!isYmd(req.body.date)) return res.status(400).send("Invalid date");
      update.date = req.body.date;
    }

    if (req.body?.title !== undefined) {
      const t = String(req.body.title ?? "").trim();
      if (!t) return res.status(400).send("Title is required");
      update.title = t;
    }

    if (req.body?.desc !== undefined) update.desc = String(req.body.desc);

    if (req.body?.startMin !== undefined) {
      const s = toMinuteInt(req.body.startMin);
      if (s === null) return res.status(400).send("Invalid startMin");
      update.startMin = s;
    }
    if (req.body?.endMin !== undefined) {
      const e = toMinuteInt(req.body.endMin);
      if (e === null) return res.status(400).send("Invalid endMin");
      update.endMin = e;
    }

    const finalStart = update.startMin ?? existing.startMin;
    const finalEnd = update.endMin ?? existing.endMin;
    if (finalEnd <= finalStart) return res.status(400).send("End time must be after start time");

    const finalKind = update.kind ?? existing.kind;

    if (finalKind === "task") {
      if (req.body?.priority !== undefined) {
        const p = normalizePriority(req.body.priority);
        if (!p) return res.status(400).send("Invalid priority");
        update.priority = p;
      }
      if (req.body?.completed !== undefined) {
        update.completed = !!req.body.completed;
      }
    }

    existing.set(update);
    const saved = await existing.save();

    return res.json(normalizeEvent(saved));
  } catch (err) {
    console.error(err);
    return res.status(400).send("Invalid request");
  }
});

app.delete("/api/events/:id", authenticateUser, async (req, res) => {
  try {
    const ownerId = req.user.userId;
    const { id } = req.params;

    const deleted = await Event.findOneAndDelete({ _id: id, ownerId });
    if (!deleted) return res.status(404).send("Event not found");

    return res.status(204).send();
  } catch (err) {
    console.error(err);
    return res.status(400).send("Invalid request");
  }
});

function getWeekRange(now = new Date()) {
  const d = new Date(now);
  const day = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setHours(0, 0, 0, 0);
  const start = new Date(d);
  start.setDate(start.getDate() - day);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function toYmd(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* =========================
   FEEDBACK (Mongo)
   ========================= */

app.get("/api/feedback", authenticateUser, async (req, res) => {
  try {
    const { start, end } = getWeekRange(new Date());
    const startYmd = toYmd(start);
    const endExclusiveYmd = toYmd(end);

    const [completedRes] = await Promise.all([
      Event.aggregate([
        {
          $match: {
            ownerId: req.user.userId,
            kind: "task",
            completed: true,
            date: { $gte: startYmd, $lt: endExclusiveYmd }
          }
        },
        { $count: "completedTasks" }
      ])
    ]);

    const completedTasks = completedRes[0]?.completedTasks ?? 0;
    res.json({ completedTasks, range: { start, end } });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err?.message || "Server error");
  }
});

/* =========================
   REFLECTIONS (Mongo)
   ========================= */

app.get("/api/reflections/week/:weekStart", authenticateUser, async (req, res) => {
  try {
    const ownerId = String(req.user.userId);
    const { weekStart } = req.params;

    if (!isYmd(weekStart)) return res.status(400).send("Invalid weekStart");

    const doc = await WeeklyReflection.findOne({ ownerId, weekStart }).lean();
    return res.json(doc ? { weekStart: doc.weekStart, text: doc.text } : { weekStart, text: "" });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err?.message || "Server error");
  }
});

app.put("/api/reflections/week/:weekStart", authenticateUser, async (req, res) => {
  try {
    const ownerId = String(req.user.userId);
    const { weekStart } = req.params;
    const { text } = req.body || {};

    if (!isYmd(weekStart)) return res.status(400).send("Invalid weekStart");
    if (text !== undefined && typeof text !== "string") return res.status(400).send("Invalid text");

    const updated = await WeeklyReflection.findOneAndUpdate(
      { ownerId, weekStart },
      { $set: { text: text ?? "" } },
      { returnDocument: "after", upsert: true } // ✅ replaces deprecated { new: true }
    ).lean();

    return res.json({ weekStart: updated.weekStart, text: updated.text });
  } catch (err) {
    console.error(err);
    return res.status(500).send(err?.message || "Server error");
  }
});

/* =========================
   Start (Azure-safe)
   ========================= */

const port = process.env.PORT || 3001;

// Start server first so Azure has something listening even if DB is slow/down
app.listen(port, () => {
  console.log(`Server running on ${port}`);
});

// Connect DB in background (logs errors instead of hanging startup)
(async function connectDbInBackground() {
  try {
    if (!process.env.MONGODB_URI) {
      throw new Error("MONGODB_URI is missing (set it in Azure App settings).");
    }
    await connectDb();
    console.log("DB connected");
  } catch (err) {
    console.error("DB connection failed:", err);
  }
})();