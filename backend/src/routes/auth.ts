import { Router } from "express";
import { z } from "zod";
import { authMiddleware, type AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { getUserById, loginUser, registerUser } from "../services/auth.js";

const authRouter = Router();

const authBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

authRouter.post("/register", async (req, res, next) => {
  try {
    const body = authBodySchema.parse(req.body);
    const result = await registerUser(body.email, body.password);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const body = authBodySchema.parse(req.body);
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

