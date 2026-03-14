import mongoose from "mongoose";

const WeeklyReflectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true
    },
    weekStart: { type: String, required: true, index: true },
    text: { type: String, default: "" }
  },
  { timestamps: true }
);

WeeklyReflectionSchema.index(
  { userId: 1, weekStart: 1 },
  { unique: true }
);

export default mongoose.model(
  "WeeklyReflection",
  WeeklyReflectionSchema
);
