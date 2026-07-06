export interface AnalysisIssue {
  id: string;
  category: string;
  severity: string;
  pageUrl: string;
  message: string;
  explanation: string;
  recommendation: string;
  selector?: string;
  screenshot?: {
    dataUrl: string;
    width: number;
    height: number;
    highlight: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  meta?: Record<string, string | number | boolean | null>;
}

export interface AnalysisPageResult {
  url: string;
  score: number;
  healthLabel: string;
  issueCount: number;
  issues: AnalysisIssue[];
}

export interface AnalysisTotals {
  issuesBySeverity: {
    critical: number;
    error: number;
    warning: number;
    info: number;
  };
  issuesByCategory: Record<string, number>;
  links: number;
  buttons: number;
  inputs: number;
  images: number;
  domNodeCount: number;
  averageLoadTimeMs: number;
}

export interface AnalysisResult {
  rootUrl: string;
  testSuites?: string[];
  securityChecks?: string[];
  score: number;
  healthLabel: string;
  pagesScanned: number;
  totals: AnalysisTotals;
  highlights: AnalysisIssue[];
  categoryBreakdown: Record<string, number>;
  pageResults: AnalysisPageResult[];
  createdAt: string;
}

export interface AnalyzeRequest {
  url: string;
  testSuites: string[];
  maxPages: number;
  maxDepth: number;
  behavior: {
    testForms: boolean;
    testSearch: boolean;
    testButtons: boolean;
    testLinks: boolean;
    sampleText: string;
    sampleEmail: string;
    samplePhone: string;
    samplePassword: string;
    sampleUrl: string;
  };
  securityChecks: string[];
}

export interface AnalysisJob {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  phase: string;
  message: string;
  targetUrl: string;
  percent: number;
  pagesDiscovered: number;
  pagesScanned: number;
  totalPages: number;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  error?: string;
}

export interface AuthUser {
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
  createdAt: string;
  updatedAt: string;
}

export interface RegisterFormData {
  email: string;
  password: string;
  fullName: string;
  companyName: string;
  role: string;
  websiteUrl: string;
  useCase: string;
  teamSize: string;
  marketingOptIn: boolean;
  acceptedTerms: boolean;
}
