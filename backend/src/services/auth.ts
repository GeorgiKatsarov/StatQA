import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import type { AuthUser } from "../types/index.js";
import { AppError } from "../utils/appError.js";

export interface RegistrationInput {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  role: string;
  websiteUrl?: string;
  useCase: string;
  teamSize: string;
  marketingOptIn: boolean;
}

function sanitizeUser(user: {
  id: string;
  email: string;
  fullName: string | null;
  companyName: string | null;
  role: string | null;
  websiteUrl: string | null;
  useCase: string | null;
  teamSize: string | null;
  marketingOptIn: boolean;
  analysesCount: number;
  createdAt: Date;
  updatedAt: Date;
}): AuthUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    companyName: user.companyName,
    role: user.role,
    websiteUrl: user.websiteUrl,
    useCase: user.useCase,
    teamSize: user.teamSize,
    marketingOptIn: user.marketingOptIn,
    analysesCount: user.analysesCount,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString()
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function registerUser(input: RegistrationInput): Promise<{ token: string; user: AuthUser }> {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new AppError("Email is already registered.", 409, "EMAIL_IN_USE");
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      fullName: input.fullName.trim(),
      companyName: input.companyName.trim(),
      role: input.role.trim(),
      websiteUrl: input.websiteUrl?.trim() || null,
      useCase: input.useCase,
      teamSize: input.teamSize,
      marketingOptIn: input.marketingOptIn,
      acceptedTermsAt: new Date()
    }
  });

  const token = jwt.sign({}, env.JWT_SECRET, { subject: user.id, expiresIn: "7d" });
  return { token, user: sanitizeUser(user) };
}

export async function loginUser(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const user = await prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
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
