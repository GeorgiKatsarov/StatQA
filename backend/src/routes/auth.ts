import { Router } from "express";
import { z } from "zod";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { getUserById, loginUser, registerUser } from "../services/auth.js";

const authRouter = Router();

const loginBodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1)
});

const strongPasswordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters.")
  .regex(/[a-z]/, "Password must include a lowercase letter.")
  .regex(/[A-Z]/, "Password must include an uppercase letter.")
  .regex(/[0-9]/, "Password must include a number.")
  .regex(/[^A-Za-z0-9]/, "Password must include a symbol.");

const optionalWebsiteSchema = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().url().optional()
);

const registerBodySchema = z.object({
  email: z.string().trim().email(),
  password: strongPasswordSchema,
  fullName: z.string().trim().min(2).max(120),
  companyName: z.string().trim().min(2).max(120),
  role: z.string().trim().min(2).max(80),
  websiteUrl: optionalWebsiteSchema,
  useCase: z.enum(["agency", "founder", "in-house", "freelancer", "qa", "other"]),
  teamSize: z.enum(["solo", "2-5", "6-20", "21-100", "100+"]),
  marketingOptIn: z.boolean().default(false),
  acceptedTerms: z.literal(true, {
    errorMap: () => ({ message: "You must accept the terms to create an account." })
  })
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = registerBodySchema.parse(req.body);
    const result = await registerUser(body);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = loginBodySchema.parse(req.body);
    const result = await loginUser(body.email, body.password);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", authMiddleware, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await getUserById(req.auth!.userId);
    res.json({ user });
  } catch (error) {
    next(error);
  }
});

export { authRouter };
