import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
  };
}

export function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ message: "Missing bearer token.", code: "UNAUTHORIZED" });
    return;
  }

  const token = header.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    req.auth = { userId: payload.sub };
    next();
  } catch {
    res.status(401).json({ message: "Invalid token.", code: "UNAUTHORIZED" });
  }
}

