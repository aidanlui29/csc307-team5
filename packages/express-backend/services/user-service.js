// services/user-service.js
import bcrypt from "bcrypt";
import { User } from "../models/user.js";

async function createUser(email, password) {
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    const err = new Error("Email already in use");
    err.code = "EMAIL_EXISTS";
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({ email: normalizedEmail, passwordHash });

  return { id: user._id.toString(), email: user.email };
}

function findUserByEmail(email) {
  if (!email) return null;
  return User.findOne({ email: email.toLowerCase().trim() });
}

async function validatePassword(userDoc, password) {
  if (!userDoc) return false;
  return bcrypt.compare(password, userDoc.passwordHash);
}

export default { createUser, findUserByEmail, validatePassword };