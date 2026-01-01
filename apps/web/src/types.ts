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

/** Tool usage by sub-agent */
export interface ToolUsage {
  name: string;
  input?: string;
  output?: string;
  duration?: number;
}

/** Hook execution info */
export interface HookExecution {
  name: string;
  type: 'pre' | 'post';
  status: 'success' | 'failed' | 'skipped';
  message?: string;
}

/** Sub-agent activity details */
export interface SubAgentActivity {
  thinking?: string;
  tools?: ToolUsage[];
  hooks?: HookExecution[];
  response?: string;
  tokenUsage?: {
    input: number;
    output: number;
  };
}

/** Real-time event from SSE stream */
export interface AgentEvent {
  agent: AgentType;
  status: TaskStatus;
  message: string;
  timestamp: string;
  artifacts?: ArtifactRef[];
  approvalRequest?: ApprovalRequest;
  selfReview?: SelfReviewSummary;
  activity?: SubAgentActivity;
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

/** Approval option for style competition */
export interface ApprovalOption {
  /** Style package ID */
  id: string;
  /** Display name (e.g., "Modern Minimalist") */
  name: string;
  /** Short description */
  description: string;
  /** Path to mega page preview HTML */
  previewPath: string;
  /** Optional thumbnail for quick preview */
  thumbnailPath?: string;
  /** Associated artifacts */
  artifacts: ArtifactRef[];
}

/** Request for user approval */
export interface ApprovalRequest {
  type: 'design' | 'architecture' | 'implementation' | 'final';
  description: string;
  artifacts: ArtifactRef[];
  /** Option IDs for selection (style competition) */
  options?: string[];
}

/** Extended approval request for style selection */
export interface StyleSelectionRequest extends ApprovalRequest {
  /** Style options for user to choose from */
  styleOptions: ApprovalOption[];
  /** Current iteration (1-5) */
  iteration: number;
  /** Max iterations before requiring specific guidance */
  maxIterations: number;
  /** Previously rejected style IDs */
  rejectedStyleIds: string[];
}

/** Type guard for style selection request */
export function isStyleSelectionRequest(
  request: ApprovalRequest
): request is StyleSelectionRequest {
  return 'styleOptions' in request && Array.isArray((request as StyleSelectionRequest).styleOptions);
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

/** Orchestrator activity log entry */
export interface OrchestratorLogEntry {
  time: string;
  phase: 'analyzing' | 'routing' | 'executing' | 'completed' | 'failed' | 'waiting';
  message: string;
  details?: string;
}

/** Project metadata */
export interface Project {
  id: string;
  name: string;
  slug: string;
  prompt: string;
  createdAt: string;
  updatedAt: string;
  status: 'initializing' | 'active' | 'archived';
  techStack?: Record<string, unknown>;
}

/** File tree node */
export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

/** Project with files */
export interface ProjectWithFiles extends Project {
  path: string;
  files: FileNode[];
}

/** Agent status for active agents panel */
export type AgentStatus = 'idle' | 'working' | 'completed' | 'failed';

/** Active agent info for real-time display */
export interface ActiveAgent {
  type: AgentType;
  status: AgentStatus;
  startedAt?: string;
  completedAt?: string;
  message?: string;
  artifactCount?: number;
}
