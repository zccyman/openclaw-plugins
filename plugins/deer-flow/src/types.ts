export type MemoryCategory = "preference" | "knowledge" | "context" | "behavior" | "goal";

export interface SkillMetadata {
  name: string;
  description: string;
  license?: string;
  allowedTools?: string[];
  enabled?: boolean;
  version?: string;
  author?: string;
}

export interface Skill extends SkillMetadata {
  path: string;
  content: string;
  directory: string;
}

export interface SkillInstallResult {
  success: boolean;
  skill?: Skill;
  error?: string;
}

export interface MemoryFact {
  id: string;
  content: string;
  category: MemoryCategory;
  confidence: number;
  createdAt: string;
  source: string;
}

export interface MemoryUserContext {
  workContext?: string;
  personalContext?: string;
  topOfMind?: string;
  recentMonths?: string;
  earlierContext?: string;
  longTermBackground?: string;
}

export interface MemoryState {
  userContext: MemoryUserContext;
  facts: MemoryFact[];
}

export interface MemorySearchParams {
  query: string;
  category?: MemoryCategory;
  limit?: number;
}

export type SubagentType = "general-purpose" | "bash" | "research" | "code" | "analysis";

export interface DelegateTaskParams {
  task: string;
  subagent_type: SubagentType;
  max_turns?: number;
  context?: string;
  expected_output?: string;
}

export interface SubagentResult {
  success: boolean;
  output: string;
  durationMs: number;
  error?: string;
  runId?: string;
}

export interface WorkflowTask {
  id: string;
  title: string;
  description: string;
  status: "pending" | "in_progress" | "completed" | "failed" | "cancelled";
  dependencies: string[];
  shipCategory: "ship" | "show" | "ask";
  files: string[];
}

export interface VirtualPathMapping {
  virtual: string;
  physical: string;
}

export interface SandboxConfig {
  mode: "local" | "docker";
  pathMappings: VirtualPathMapping[];
  workingDir: string;
  timeout: number;
  bashEnabled: boolean;
}

export interface SandboxExecResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
}

export interface DeerFlowPluginConfig {
  skillsPath?: string;
  memoryEnabled?: boolean;
  maxMemoryFacts?: number;
  defaultSubagentType?: SubagentType;
  sandboxMode?: "local" | "docker";
  sandboxBashEnabled?: boolean;
}

export type WorkflowMode = "quick" | "standard" | "full";

export interface FeatureFlags {
  strictTdd: boolean;
  qaGateBlocking: boolean;
  autoCommit: boolean;
  conventionalCommits: boolean;
  githubIntegration: boolean;
  agentParallelism: boolean;
}

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  strictTdd: false,
  qaGateBlocking: true,
  autoCommit: false,
  conventionalCommits: true,
  githubIntegration: false,
  agentParallelism: true,
};

export interface WorkflowContext {
  projectId: string;
  projectDir: string;
  mode: WorkflowMode;
  currentStep: string;
  spec: WorkflowSpec | null;
  activeTaskIndex: number;
  brainstormNotes: string[];
  decisions: string[];
  qaGateResults: Array<{ name: string; passed: boolean; output: string }>;
  startedAt: string;
  openSource: boolean | null;
  branchName: string | null;
  featureFlags: FeatureFlags;
}

export interface WorkflowSpec {
  proposal: string;
  design: string;
  tasks: WorkflowTask[];
}

export interface AgentResult {
  agentId: string;
  task: string;
  success: boolean;
  output: string;
  durationMs: number;
}

export interface TechSelection {
  language: string;
  framework: string;
  architecture: string;
  patterns: string[];
}

export interface ConventionalCommit {
  type: string;
  scope?: string;
  description: string;
  body?: string;
}
