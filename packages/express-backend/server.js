// packages/express-backend/server.js
import express from "express";
import dotenv from "dotenv";
import authRouter from "./routes/auth.js"; // if you have it
import { connectDb } from "./db.js";

dotenv.config();

const app = express();
app.use(express.json());

app.use("/api/auth", authRouter); // optional, if you created auth routes

app.get("/api/health", (req, res) => res.json({ ok: true }));

const port = process.env.PORT || 3001;

async function start() {
  try {
    // debug line (optional): show what URI process sees
    // console.log("MONGODB_URI:", process.env.MONGODB_URI);

    await connectDb();
    app.listen(port, () => console.log(`Server running on ${port}`));
  } catch (err) {
    console.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();