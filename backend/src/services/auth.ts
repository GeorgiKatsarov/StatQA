import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import type { AuthUser } from "../types/index.js";
import { AppError } from "../utils/appError.js";

function sanitizeUser(user: {
  id: string;
  email: string;
  analysesCount: number;
  createdAt: Date;
  updatedAt: Date;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    analysesCount: user.analysesCount,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

export async function registerUser(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("Email is already registered.", 409, "EMAIL_IN_USE");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash
    }
  });

  const token = jwt.sign({}, env.JWT_SECRET, { subject: user.id, expiresIn: "7d" });
  return { token, user: sanitizeUser(user) };
}

export async function loginUser(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }

  const matches = await bcrypt.compare(password, user.passwordHash);
  if (!matches) {
    throw new AppError("Invalid email or password.", 401, "INVALID_CREDENTIALS");
  }

  const token = jwt.sign({}, env.JWT_SECRET, { subject: user.id, expiresIn: "7d" });
  return { token, user: sanitizeUser(user) };
}

export async function getUserById(userId: string): Promise<AuthUser> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError("User not found.", 404, "USER_NOT_FOUND");
  }

  return sanitizeUser(user);
}
