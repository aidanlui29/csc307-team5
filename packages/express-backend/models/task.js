import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
  {
    plannerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Planner",
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    priority: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH"],
      default: "MEDIUM"
    },
    status: {
      type: String,
      enum: ["TODO", "DONE"],
      default: "TODO"
    },
    scheduledFor: {
      type: Date
    },
    dueDate: {
      type: Date,
      index: true
    }
  },
  { timestamps: true }
);

taskSchema.index({ ownerId: 1, createdAt: -1 });

export const Task = mongoose.model("Task", taskSchema);
