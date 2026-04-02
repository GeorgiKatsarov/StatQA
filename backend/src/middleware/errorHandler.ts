import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/appError.js";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: "Route not found." });
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Validation failed.",
      code: "VALIDATION_ERROR",
      details: error.flatten()
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      message: error.message,
      code: error.code,
      details: error.details
    });
    return;
  }

  if (error instanceof Error) {
    res.status(400).json({
      message: error.message,
      code: "REQUEST_ERROR"
    });
    return;
  }

  res.status(500).json({
    message: "Unexpected server error.",
    code: "INTERNAL_SERVER_ERROR"
  });
}
