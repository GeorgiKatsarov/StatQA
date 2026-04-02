const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000";

interface ApiErrorShape {
  message?: string;
  code?: string;
  details?: unknown;
}

export class ApiError extends Error {
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, code?: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  const json = (await response.json()) as T | ApiErrorShape;
  if (!response.ok) {
    const apiError = json as ApiErrorShape;
    throw new ApiError(apiError.message || "Request failed.", apiError.code, apiError.details);
  }

  return json as T;
}

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("statqa_token");
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers
  });

  return parseJson<T>(response);
}

export interface AnalysisSummary {
  id: string;
  url: string;
  score: number;
  healthLabel: string;
  createdAt: string;
}

export interface StoredAnalysisResponse<T> {
  analysis: {
    id: string;
    url: string;
    score: number;
    healthLabel: string;
    createdAt: string;
    reportJson: T;
  };
}
