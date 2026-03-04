import mongoose from "mongoose";

const EventSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    plannerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Planner",
      required: true,
      index: true
    },

    kind: {
      type: String,
      enum: ["task", "schedule"],
      required: true
    },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    title: { type: String, required: true, trim: true },
    desc: { type: String, default: "" },
    startMin: { type: Number, required: true },
    endMin: { type: Number, required: true },

    // NEW: task-only semantics (still stored on all docs for simplicity)
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium"
    },
    completed: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

EventSchema.index({ ownerId: 1, plannerId: 1, date: 1, startMin: 1 });

export const Event = mongoose.model("Event", EventSchema);