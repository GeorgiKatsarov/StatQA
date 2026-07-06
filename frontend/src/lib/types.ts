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
  score: number;
  healthLabel: string;
  pagesScanned: number;
  totals: AnalysisTotals;
  highlights: AnalysisIssue[];
  categoryBreakdown: Record<string, number>;
  pageResults: AnalysisPageResult[];
  createdAt: string;
}

export interface AuthUser {
  id: string;
  email: string;
  analysesCount: number;
  createdAt: string;
  updatedAt: string;
}
