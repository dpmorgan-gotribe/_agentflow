/** Task created by the orchestrator */
export interface Task {
  id: string;
  projectId: string;
  prompt: string;
  status: TaskStatus;
  analysis?: TaskAnalysis;
  currentAgent?: AgentType;
  completedAgents?: AgentType[];
  createdAt: string;
  updatedAt?: string;
}

export type TaskStatus =
  | 'pending'
  | 'analyzing'
  | 'orchestrating'
  | 'agent_working'
  | 'awaiting_approval'
  | 'completed'
  | 'failed';

export interface TaskAnalysis {
  taskType: string;
  complexity: 'simple' | 'moderate' | 'complex';
  requiresUI: boolean;
  requiresBackend: boolean;
  requiresArchitecture: boolean;
  requiresApproval: boolean;
  suggestedAgents: AgentType[];
}

export type AgentType =
  | 'system'
  | 'orchestrator'
  | 'project_manager'
  | 'architect'
  | 'analyst'
  | 'project_analyzer'
  | 'compliance'
  | 'ui_designer'
  | 'frontend_developer'
  | 'backend_developer'
  | 'tester'
  | 'bug_fixer'
  | 'reviewer'
  | 'git_agent';

/** Real-time event from SSE stream */
export interface AgentEvent {
  agent: AgentType;
  status: TaskStatus;
  message: string;
  timestamp: string;
  artifacts?: ArtifactRef[];
  approvalRequest?: ApprovalRequest;
  selfReview?: SelfReviewSummary;
}

/** Reference to an artifact (summary) */
export interface ArtifactRef {
  id: string;
  type: ArtifactType;
  name: string;
}

/** Full artifact with content */
export interface Artifact {
  id: string;
  type: ArtifactType;
  name: string;
  path: string;
  content?: string;
}

export type ArtifactType =
  | 'mockup'
  | 'stylesheet'
  | 'flow'
  | 'source_file'
  | 'test_file'
  | 'config'
  | 'documentation';

/** Request for user approval */
export interface ApprovalRequest {
  type: 'design' | 'architecture' | 'implementation' | 'final';
  description: string;
  artifacts: ArtifactRef[];
}

/** Self-review summary from agent output */
export interface SelfReviewSummary {
  iteration: number;
  maxIterations: number;
  qualityScore: number;
  completenessScore: number;
  decision: 'approved' | 'needs_work' | 'escalate';
  gapsCount: number;
  criticalGapsCount: number;
}

/** Git branch info */
export interface GitBranch {
  name: string;
  isCurrent: boolean;
  ahead: number;
  behind: number;
}

/** Git worktree info */
export interface GitWorktree {
  name: string;
  branch: string;
  path: string;
  agent?: AgentType;
  status: 'active' | 'paused' | 'idle';
  modifiedAt?: string;
}

/** Agent log entry */
export interface AgentLogEntry {
  time: string;
  action: 'reading' | 'writing' | 'commit' | 'spawned' | 'error' | 'connect' | 'apply';
  agent?: AgentType;
  message: string;
}
