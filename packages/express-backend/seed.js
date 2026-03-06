import mongoose from "mongoose";
import { connectDb } from "./db.js";
import { User } from "./models/user.js";
import { Planner } from "./models/planner.js";
import { Task } from "./models/task.js";
import { Event } from "./models/event.js";

async function run() {
  await connectDb();

  const user = await User.create({
    name: "Alice",
    email: "alice@example.com",
    passwordHash: "hash_goes_here"
  });

  const planner = await Planner.create({
    ownerId: user._id,
    title: "My Planner",
    color: "#22c55e"
  });

  const task = await Task.create({
    plannerId: planner._id,
    title: "Study MongoDB",
    description: "Mongoose schemas + indexes",
    priority: "HIGH",
    status: "TODO",
    dueDate: new Date()
  });

  await Event.create({
    ownerId: user._id,
    plannerId: planner._id,
    kind: "task",
    date: "2026-03-06",
    title: task.title,
    desc: task.description,
    startMin: 9 * 60,
    endMin: 10 * 60,
    priority: "high",
    completed: false
  });

  console.log("✅ Seeded all collections");
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});