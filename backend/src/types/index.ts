export type Severity = "critical" | "error" | "warning" | "info";
export type TestSuite = "content" | "behavior" | "security";
export type SecurityCheck =
  | "https"
  | "hsts"
  | "csp"
  | "clickjacking"
  | "mixed-content"
  | "insecure-forms"
  | "password-http";

export interface BehaviorTestConfig {
  testForms: boolean;
  testSearch: boolean;
  testButtons: boolean;
  testLinks: boolean;
  sampleText: string;
  sampleEmail: string;
  samplePhone: string;
  samplePassword: string;
  sampleUrl: string;
}

export interface AnalysisOptions {
  testSuites: TestSuite[];
  behavior: BehaviorTestConfig;
  securityChecks: SecurityCheck[];
  maxPages: number;
  maxDepth: number;
}

export interface AnalysisProgress {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  phase: "queued" | "validating" | "discovering" | "scanning" | "scoring" | "saving" | "completed" | "failed";
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

export type IssueCategory =
  | "links"
  | "buttons"
  | "inputs"
  | "forms"
  | "behavior"
  | "images"
  | "structure"
  | "meta"
  | "performance"
  | "security"
  | "accessibility"
  | "content"
  | "console";

export interface LinkSnapshot {
  href: string;
  text: string;
  isInternal: boolean;
  selector?: string;
  screenshot?: IssueScreenshot;
}

export interface ButtonSnapshot {
  text: string;
  label: string;
  type: string | null;
  visible: boolean;
  disabled: boolean;
  formIndex: number | null;
  selector?: string;
  screenshot?: IssueScreenshot;
}

export interface InputSnapshot {
  type: string | null;
  name: string | null;
  label: string | null;
  required: boolean;
  placeholder: string | null;
  visible: boolean;
  disabled: boolean;
  editable: boolean;
  formIndex: number | null;
  selector?: string;
  screenshot?: IssueScreenshot;
}

export interface FormSnapshot {
  action: string | null;
  method: string | null;
  hasSubmitButton: boolean;
  inputCount: number;
  editableInputCount: number;
  requiredInputCount: number;
  kind: "search" | "login" | "contact" | "newsletter" | "generic";
  selector?: string;
  screenshot?: IssueScreenshot;
}

export interface ImageSnapshot {
  src: string;
  alt: string | null;
  loaded: boolean;
  naturalWidth: number;
  naturalHeight: number;
  selector?: string;
  screenshot?: IssueScreenshot;
}

export interface AccessibilitySignals {
  unlabeledInputs: number;
  landmarksPresent: string[];
}

export interface SecuritySignals {
  isHttps: boolean;
  responseHeaders: Record<string, string>;
  mixedContentUrls: string[];
  insecureFormActions: Array<{
    action: string;
    selector?: string;
  }>;
  passwordFieldsOnInsecurePage: number;
}

export interface ScrapedData {
  url: string;
  finalUrl: string;
  title: string;
  description: string;
  lang: string;
  headings: string[];
  links: LinkSnapshot[];
  buttons: ButtonSnapshot[];
  inputs: InputSnapshot[];
  forms: FormSnapshot[];
  images: ImageSnapshot[];
  videos: string[];
  iframes: string[];
  landmarks: string[];
  textContent: string;
  domNodeCount: number;
  scriptCount: number;
  consoleErrors: string[];
  loadTimeMs: number;
  accessibilitySignals: AccessibilitySignals;
  securitySignals: SecuritySignals;
  behaviorChecks: BehaviorCheck[];
  pageScreenshot?: IssueScreenshot;
}

export interface BehaviorCheck {
  id: string;
  pageUrl: string;
  category: "search" | "form" | "button" | "link";
  target: string;
  status: "passed" | "failed" | "skipped";
  message: string;
  selector?: string;
  screenshot?: IssueScreenshot;
  meta?: Record<string, string | number | boolean | null>;
}

export interface IssueScreenshot {
  dataUrl: string;
  width: number;
  height: number;
  highlight: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface Issue {
  id: string;
  pageUrl: string;
  category: IssueCategory;
  severity: Severity;
  message: string;
  explanation: string;
  recommendation: string;
  selector?: string;
  screenshot?: IssueScreenshot;
  meta?: Record<string, string | number | boolean | null>;
}

export interface PageMetrics {
  links: number;
  buttons: number;
  inputs: number;
  images: number;
  domNodeCount: number;
  loadTimeMs: number;
}

export interface PageResult {
  url: string;
  score: number;
  healthLabel: string;
  issueCount: number;
  issues: Issue[];
  metrics: PageMetrics;
  summary: string;
}

export interface AnalysisTotals {
  issuesBySeverity: Record<Severity, number>;
  issuesByCategory: Partial<Record<IssueCategory, number>>;
  links: number;
  buttons: number;
  inputs: number;
  images: number;
  domNodeCount: number;
  averageLoadTimeMs: number;
}

export interface AnalysisResult {
  rootUrl: string;
  testSuites: TestSuite[];
  securityChecks?: SecurityCheck[];
  score: number;
  healthLabel: string;
  pagesScanned: number;
  totals: AnalysisTotals;
  highlights: Issue[];
  categoryBreakdown: Partial<Record<IssueCategory, number>>;
  pageResults: PageResult[];
  createdAt: string;
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
