import mongoose from "mongoose";

const PlannerSchema = new mongoose.Schema(
  {
    ownerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: "#9ca3af" },
    description: { type: String, default: "" }
  },
  { timestamps: true }
);

PlannerSchema.index({ ownerId: 1, createdAt: -1 });

export const Planner = mongoose.model("Planner", PlannerSchema);