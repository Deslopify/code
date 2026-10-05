export interface IAbortSignal {
	readonly aborted: boolean;
	addEventListener(type: 'abort', listener: (this: AbortSignal) => void): void;
	removeEventListener(
		type: 'abort',
		listener: (this: AbortSignal) => void,
	): void;
}
export interface FetchOptions {
	callSite: string;
	headers?: {
		[name: string]: string;
	};
	body?: BodyInit;
	timeout?: number;
	json?: any;
	method?: 'GET' | 'POST' | 'PUT';
	signal?: IAbortSignal;
	suppressIntegrationId?: boolean;
}
export interface PaginationOptions<T> extends FetchOptions {
	pageSize?: number;
	startPage?: number;
	getItemsFromResponse: (data: any) => T[];
	buildUrl: (baseUrl: string, pageSize: number, page: number) => string;
}
export type MakeRequestOptions = Omit<FetchOptions, 'callSite'> & {
	callSite?: string;
};
export interface WebSocketConnectOptions {
	headers?: {
		[name: string]: string;
	};
	suppressIntegrationId?: boolean;
}
export interface IFetcherService {
	fetch(url: string, options: FetchOptions): Promise<any>;
	fetchWithPagination<T>(
		baseUrl: string,
		options: PaginationOptions<T>,
	): Promise<T[]>;
	createWebSocket(url: string, options?: WebSocketConnectOptions): any;
}
export interface IExtensionInformation {
	name: string;
	sessionId: string;
	machineId: string;
	deviceId: string;
	vscodeVersion: string;
	version: string;
	buildType: 'dev' | 'prod';
}
export interface CopilotToken {
	endpoints: {
		api?: string;
		telemetry?: string;
		proxy?: string;
		'origin-tracker'?: string;
	};
	sku: string;
}
export interface RemoteAgentJobPayload {
	problem_statement: string;
	event_type: string;
	event_content: string;
	pull_request?: {
		title?: string;
		body_placeholder?: string;
		body_suffix?: string;
		base_ref?: string;
		head_ref?: string;
	};
	run_name?: string;
	custom_agent?: string;
	agent_id?: number;
	model?: string;
}
export enum RequestType {
	CopilotToken = 'CopilotToken',
	CopilotNLToken = 'CopilotNLToken',
	ChatCompletions = 'ChatCompletions',
	ChatResponses = 'ChatResponses',
	ChatMessages = 'ChatMessages',
	ProxyCompletions = 'ProxyCompletions',
	ProxyChatCompletions = 'ProxyChatCompletions',
	RemoteAgent = 'RemoteAgent',
	RemoteAgentChat = 'RemoteAgentChat',
	CodeReviewAgent = 'CodeReviewAgent',
	CAPIEmbeddings = 'CAPIEmbeddings',
	DotcomEmbeddings = 'DotcomEmbeddings',
	EmbeddingsModels = 'EmbeddingsModels',
	Models = 'Models',
	AutoModels = 'AutoModels',
	Chunks = 'Chunks',
	EmbeddingsCodeSearch = 'EmbeddingsCodeSearch',
	ListSkills = 'ListSkills',
	SearchSkill = 'SearchSkill',
	ContentExclusion = 'ContentExclusion',
	Telemetry = 'Telemetry',
	CopilotUserInfo = 'CopilotUserInfo',
	ModelPolicy = 'ModelPolicy',
	ListModel = 'ListModel',
	SnippyMatch = 'SnippyMatch',
	SnippyFilesForMatch = 'SnippyFlesForMatch',
	CodingGuidelines = 'CodingGuidelines',
	EmbeddingsIndex = 'EmbedingsIndex',
	ChatAttachmentUpload = 'ChatAttachmentUpload',
	CopilotSessionLogs = 'CopilotSessionLogs',
	CopilotSessionDetails = 'CopilotSessionDetails',
	CopilotSessions = 'CopilotSessions',
	CopilotAgentJob = 'CopilotAgentJob',
	CCAModelsList = 'CCAModelsList',
	CopilotCustomAgents = 'CopilotCustomAgents',
	CopilotCustomAgentsDetail = 'CopilotCustomAgentsDetail',
	OrgCustomInstructions = 'OrgCustomInstructions',
	CopilotAgentMemory = 'CopilotAgentMemory',
	CopilotAgentJobEnabled = 'CopilotAgentJobEnabled',
	AgentTask = 'AgentTask',
	ModelRouter = 'ModelRouter',
	Auto = 'Auto',
}
export type RequestMetadata =
	| {
			type: Exclude<
				RequestType,
				| RequestType.ListModel
				| RequestType.ModelPolicy
				| RequestType.SearchSkill
				| RequestType.RemoteAgentChat
				| RequestType.ContentExclusion
				| RequestType.ChatCompletions
				| RequestType.ChatResponses
				| RequestType.ChatMessages
				| RequestType.Models
				| RequestType.CodingGuidelines
				| RequestType.EmbeddingsIndex
				| RequestType.ChatAttachmentUpload
				| RequestType.CopilotSessionLogs
				| RequestType.CopilotSessionDetails
				| RequestType.CopilotSessions
				| RequestType.CopilotAgentJob
				| RequestType.CCAModelsList
				| RequestType.CopilotCustomAgents
				| RequestType.CopilotCustomAgentsDetail
				| RequestType.OrgCustomInstructions
				| RequestType.CopilotAgentMemory
				| RequestType.CopilotAgentJobEnabled
				| RequestType.AgentTask
			>;
	  }
	| {
			type: RequestType.CodingGuidelines | RequestType.EmbeddingsIndex;
			repoWithOwner: string;
	  }
	| {
			type:
				| RequestType.ChatCompletions
				| RequestType.ChatResponses
				| RequestType.ChatMessages
				| RequestType.Models;
			isModelLab?: boolean;
	  }
	| {
			type: RequestType.ListModel | RequestType.ModelPolicy;
			modelId: string;
			isModelLab?: boolean;
	  }
	| {
			type: RequestType.SearchSkill;
			slug: string;
	  }
	| {
			type: RequestType.RemoteAgentChat;
			slug?: string;
	  }
	| {
			type: RequestType.ContentExclusion;
			repos: string[];
	  }
	| {
			type: RequestType.ChatAttachmentUpload;
			uploadName: string;
			mimeType: string;
	  }
	| {
			type: RequestType.CopilotSessionLogs | RequestType.CopilotSessionDetails;
			sessionId: string;
	  }
	| {
			type: RequestType.CopilotSessions;
			prId?: string;
			nwo?: string;
			resourceState?: string;
	  }
	| {
			type: RequestType.CopilotAgentJob;
			owner: string;
			repo: string;
			payload?: RemoteAgentJobPayload;
			jobId?: string;
			sessionId?: string;
			apiVersion?: string;
	  }
	| {
			type: RequestType.CCAModelsList;
	  }
	| {
			type: RequestType.CopilotCustomAgents;
			owner: string;
			repo: string;
			target?: 'github-copilot' | 'vscode';
			exclude_invalid_config?: boolean;
			dedupe?: boolean;
			include_sources?: Array<'repo' | 'org' | 'enterprise'>;
	  }
	| {
			type: RequestType.CopilotCustomAgentsDetail;
			owner: string;
			repo: string;
			customAgentName: string;
			version?: string;
	  }
	| {
			type: RequestType.OrgCustomInstructions;
			orgLogin: string;
	  }
	| {
			type: RequestType.CopilotAgentMemory;
			repo: string;
			action?: 'search' | 'recent' | 'enabled';
			limit?: number;
	  }
	| {
			type: RequestType.CopilotAgentJobEnabled;
			owner: string;
			repo: string;
	  }
	| {
			type: RequestType.AgentTask;
			action: AgentTaskAction;
			owner?: string;
			repo?: string;
			taskId?: string;
			searchParams?: Record<string, string | number | boolean>;
	  };
export interface IDomainChangeResponse {
	capiUrlChanged: boolean;
	telemetryUrlChanged: boolean;
	dotcomUrlChanged: boolean;
	proxyUrlChanged: boolean;
}
interface CCAModelTokenPriceTier {
	input_price?: number;
	cache_price?: number;
	output_price?: number;
	context_max?: number;
}
interface CCAModelTokenPrices {
	batch_size?: number;
	input_price?: number;
	cache_price?: number;
	output_price?: number;
	default?: CCAModelTokenPriceTier;
	long_context?: CCAModelTokenPriceTier;
}
interface CCAModelBilling {
	is_premium: boolean;
	multiplier: number;
	restricted_to: string[];
	token_prices?: CCAModelTokenPrices;
}
interface CCAModelVisionLimits {
	max_prompt_image_size: number;
	max_prompt_images: number;
	supported_media_types: string[];
}
interface CCAModelLimits {
	max_context_window_tokens: number;
	max_output_tokens: number;
	max_prompt_tokens: number;
	vision?: CCAModelVisionLimits;
}
interface CCAModelSupports {
	max_thinking_budget?: number;
	min_thinking_budget?: number;
	parallel_tool_calls: boolean;
	streaming: boolean;
	tool_calls: boolean;
	vision: boolean;
}
interface CCAModelCapabilities {
	family: string;
	limits: CCAModelLimits;
	object: string;
	supports: CCAModelSupports;
	tokenizer: string;
	type: string;
}
interface CCAModelPolicy {
	state: string;
	terms: string;
}
export interface CCAModel {
	billing: CCAModelBilling;
	capabilities: CCAModelCapabilities;
	id: string;
	is_chat_default: boolean;
	is_chat_fallback: boolean;
	model_picker_category: string;
	model_picker_enabled: boolean;
	model_picker_price_category?: string;
	name: string;
	object: string;
	policy: CCAModelPolicy;
	preview: boolean;
	supported_endpoints: string[];
	vendor: string;
	version: string;
}
/**
 * Discriminator selecting which Task API endpoint to call. Maps to operation IDs in the
 * Mission Control OpenAPI spec (`copilot-mission-control/api/generated-sessions-openapi.yaml`).
 */
export type AgentTaskAction =
	| 'create'
	| 'list'
	| 'list-for-repo'
	| 'get'
	| 'events'
	| 'steer'
	| 'create-pr'
	| 'archive'
	| 'unarchive';
/** Lifecycle state of a Task (spec: `TaskState`). */
export type AgentTaskState =
	| 'queued'
	| 'in_progress'
	| 'idle'
	| 'waiting_for_user'
	| 'completed'
	| 'failed'
	| 'timed_out'
	| 'cancelled';
/** Spec: `User` schema. */
export interface AgentTaskUser {
	readonly id?: number;
	readonly login?: string;
	readonly node_id?: string;
	readonly url?: string;
}
/** Spec: `Repository` schema — currently only exposes `id`. */
export interface AgentTaskRepository {
	readonly id?: number;
}
/** Spec: `GitHubResource` schema (used when `TaskArtifact.type === "pull"`). */
export interface AgentTaskGitHubResourceData {
	/** Database id of the GitHub resource (e.g. internal PR id; NOT the user-facing PR number). */
	readonly id: number;
	readonly type?: string;
	/** GraphQL global ID. */
	readonly global_id?: string;
	readonly state?: 'open' | 'draft' | 'closed' | 'merged';
}
/** Spec: `BranchResource` schema (used when `TaskArtifact.type === "branch"`). */
export interface AgentTaskBranchResourceData {
	readonly head_ref: string;
	readonly base_ref: string;
}
/** Spec: `TaskArtifact`. */
export interface AgentTaskArtifact {
	readonly provider: 'github' | string;
	readonly type: 'pull' | 'branch' | string;
	readonly data:
		| AgentTaskGitHubResourceData
		| AgentTaskBranchResourceData
		| Record<string, unknown>;
}
interface TaskAgentCollaborator {
	readonly slug?: string;
}
/** Spec: `Task`. `owner` and `repository` are siblings — `repository` carries only `id`. */
export interface AgentTask {
	readonly id: string;
	readonly url?: string;
	readonly html_url?: string;
	readonly name?: string;
	readonly creator?: AgentTaskUser;
	readonly creator_type?: 'user' | 'organization';
	readonly owner?: AgentTaskUser;
	readonly repository?: AgentTaskRepository;
	readonly state: AgentTaskState;
	readonly remote_steerable?: boolean;
	readonly session_count?: number;
	readonly artifacts?: readonly AgentTaskArtifact[];
	readonly archived_at?: string | null;
	readonly created_at: string;
	readonly updated_at?: string;
	readonly agent_collaborators?: readonly TaskAgentCollaborator[];
	readonly compute: {
		provider: string;
	};
}
/** Spec: `Session` (members of `GetTaskResponse.sessions`). */
export interface AgentTaskSession {
	readonly id: string;
	readonly name?: string;
	readonly user?: AgentTaskUser;
	readonly owner?: AgentTaskUser;
	readonly repository?: AgentTaskRepository;
	readonly task_id?: string;
	readonly state: AgentTaskState;
	readonly created_at: string;
	readonly updated_at?: string;
	readonly completed_at?: string;
	readonly prompt?: string;
	readonly head_ref?: string;
	readonly base_ref?: string;
	readonly model?: string;
	readonly resource_global_id?: string;
}
/** Spec: `GetTaskResponse` (Task + sessions). */
export interface AgentTaskGetResponse extends AgentTask {
	readonly sessions?: readonly AgentTaskSession[];
}
/** Spec: `ListTasksResponse`. */
export interface AgentTaskListResponse {
	readonly tasks: readonly AgentTask[];
	readonly total_active_count?: number;
	readonly total_archived_count?: number;
}
/** Spec: `CreateTaskRequest`. */
export interface AgentTaskCreateRequest {
	readonly prompt: string;
	readonly agent_id?: number;
	readonly repositories?: readonly {
		owner: string;
		name: string;
	}[];
	readonly problem_statement?: string;
	readonly event_content?: string;
	readonly model?: string;
	readonly custom_agent?: string;
	readonly create_pull_request?: boolean;
	readonly base_ref?: string;
	readonly head_ref?: string;
	readonly event_type?: string;
}
/** Spec: `SteerTaskRequest`. */
export interface AgentTaskSteerRequest {
	readonly content: string;
	readonly type?:
		| 'user_message'
		| 'ask_user_response'
		| 'plan_approval_response'
		| 'permission_response'
		| 'elicitation_response'
		| 'abort'
		| 'mode_switch';
	readonly problem_statement?: string;
	readonly model?: string;
	readonly event_type?: string;
}
/**
 * Spec: `SessionEventType` enum.
 *
 * For the strongly-typed event payloads, use {@link AgentTaskSessionEvent} and
 * narrow on its `type` field.
 */
export type AgentTaskSessionEventType =
	| 'session.start'
	| 'session.resume'
	| 'session.error'
	| 'session.idle'
	| 'session.info'
	| 'session.model_change'
	| 'session.remote_steerable_changed'
	| 'session.import_legacy'
	| 'session.handoff'
	| 'session.truncation'
	| 'session.title_changed'
	| 'session.shutdown'
	| 'session.requested'
	| 'user.message'
	| 'user_input.requested'
	| 'user_input.completed'
	| 'assistant.turn_start'
	| 'assistant.intent'
	| 'assistant.message'
	| 'assistant.turn_end'
	| 'assistant.usage'
	| 'assistant.streaming_delta'
	| 'assistant.reasoning_delta'
	| 'assistant.message_delta'
	| 'abort'
	| 'tool.user_requested'
	| 'tool.execution_start'
	| 'tool.execution_partial_result'
	| 'tool.execution_complete'
	| 'custom_agent.started'
	| 'custom_agent.completed'
	| 'custom_agent.failed'
	| 'custom_agent.selected'
	| 'hook.start'
	| 'hook.end'
	| 'system.message'
	| 'permission.requested'
	| 'permission.completed'
	| 'elicitation.requested'
	| 'elicitation.completed'
	| 'exit_plan_mode.requested'
	| 'exit_plan_mode.completed';
/** Spec: `BaseSessionEvent` — fields common to every session event. */
export interface AgentTaskSessionEventBase {
	readonly id: string;
	readonly timestamp: string;
	readonly parentId: string | null;
	readonly ephemeral?: boolean;
	readonly pending?: boolean;
	readonly dismissed?: boolean;
}
/** Spec: `Repository` (subschema used in session event payloads). */
export interface AgentTaskEventRepository {
	readonly owner: string;
	readonly name: string;
	readonly branch?: string;
}
/** Spec: `Attachment`. */
export interface AgentTaskAttachment {
	readonly type: 'file' | 'directory';
	readonly path: string;
	readonly displayName: string;
}
/** Spec: `ToolRequest`. */
export interface AgentTaskToolRequest {
	readonly toolCallId: string;
	readonly name: string;
	readonly arguments: unknown;
}
/** Spec: `QuotaSnapshot`. */
export interface AgentTaskQuotaSnapshot {
	readonly isUnlimitedEntitlement: boolean;
	readonly entitlementRequests: number;
	readonly usedRequests: number;
	readonly usageAllowedWithExhaustedQuota: boolean;
	readonly overage: number;
	readonly overageAllowedWithExhaustedQuota: boolean;
	readonly remainingPercentage: number;
	readonly resetDate?: string;
}
/** Spec: `WorkingDirectoryContext`. */
export interface AgentTaskWorkingDirectoryContext {
	readonly cwd?: string;
	readonly gitRoot?: string;
	readonly repository?: string;
	readonly hostType?: string;
	readonly branch?: string;
	readonly headCommit?: string;
	readonly baseCommit?: string;
}
export interface AgentTaskSessionStartEventData {
	readonly sessionId: string;
	readonly version: number;
	readonly producer: string;
	readonly copilotVersion: string;
	readonly startTime: string;
	readonly selectedModel?: string;
	readonly context?: AgentTaskWorkingDirectoryContext;
	readonly remoteSteerable?: boolean;
}
export interface AgentTaskSessionResumeEventData {
	readonly resumeTime: string;
	readonly eventCount: number;
	readonly remoteSteerable?: boolean;
}
export interface AgentTaskSessionErrorEventData {
	readonly errorType: string;
	readonly message: string;
	readonly stack?: string;
}
export interface AgentTaskSessionIdleEventData {}
export interface AgentTaskSessionInfoEventData {
	readonly infoType: string;
	readonly message: string;
}
export interface AgentTaskSessionModelChangeEventData {
	readonly previousModel?: string;
	readonly newModel: string;
}
export interface AgentTaskSessionRemoteSteerableChangedEventData {
	readonly remoteSteerable: boolean;
}
export interface AgentTaskSessionImportLegacyEventData {
	readonly legacySession: Record<string, unknown>;
	readonly importTime: string;
	readonly sourceFile: string;
}
export interface AgentTaskSessionHandoffEventData {
	readonly handoffTime: string;
	readonly sourceType: 'remote' | 'local';
	readonly repository?: AgentTaskEventRepository;
	readonly context?: string;
	readonly summary?: string;
	readonly remoteSessionId?: string;
}
export interface AgentTaskSessionTruncationEventData {
	readonly tokenLimit: number;
	readonly preTruncationTokensInMessages: number;
	readonly preTruncationMessagesLength: number;
	readonly postTruncationTokensInMessages: number;
	readonly postTruncationMessagesLength: number;
	readonly tokensRemovedDuringTruncation: number;
	readonly messagesRemovedDuringTruncation: number;
	readonly performedBy: string;
}
export interface AgentTaskSessionTitleChangedEventData {
	readonly title: string;
}
export interface AgentTaskSessionShutdownEventData {
	readonly shutdownType: 'routine' | 'error';
	readonly errorReason?: string;
}
export interface AgentTaskSessionRequestedEventData {
	readonly originType: string;
	readonly label: string;
	readonly url?: string | null;
	readonly globalId?: string | null;
}
export interface AgentTaskUserMessageEventData {
	readonly content: string;
	readonly transformedContent?: string;
	readonly attachments?: readonly AgentTaskAttachment[];
	readonly source?: string;
}
export interface AgentTaskUserInputRequestedEventData {
	readonly requestId: string;
	readonly question: string;
	readonly choices?: readonly string[];
	readonly allowFreeform?: boolean;
	readonly toolCallId?: string;
}
export interface AgentTaskUserInputCompletedEventData {
	readonly requestId: string;
	readonly answer?: string;
	readonly wasFreeform?: boolean;
}
export interface AgentTaskAssistantTurnStartEventData {
	readonly turnId: string;
}
export interface AgentTaskAssistantIntentEventData {
	readonly intent: string;
}
export interface AgentTaskAssistantMessageEventData {
	readonly messageId: string;
	readonly content: string;
	readonly chunkContent?: string;
	readonly reasoningText?: string;
	readonly reasoningOpaque?: string;
	readonly encryptedContent?: string;
	readonly totalResponseSizeBytes?: number;
	readonly toolRequests?: readonly AgentTaskToolRequest[];
	readonly parentToolCallId?: string;
}
export interface AgentTaskAssistantTurnEndEventData {
	readonly turnId: string;
}
export interface AgentTaskAssistantUsageEventData {
	readonly model?: string;
	readonly inputTokens?: number;
	readonly outputTokens?: number;
	readonly cacheReadTokens?: number;
	readonly cacheWriteTokens?: number;
	readonly cost?: number;
	readonly duration?: number;
	readonly initiator?: string;
	readonly apiCallId?: string;
	readonly providerCallId?: string;
	readonly quotaSnapshots?: Record<string, AgentTaskQuotaSnapshot>;
}
export interface AgentTaskAssistantStreamingDeltaEventData {
	readonly totalResponseSizeBytes: number;
}
export interface AgentTaskAssistantReasoningDeltaEventData {
	readonly reasoningId: string;
	readonly deltaContent: string;
}
export interface AgentTaskAssistantMessageDeltaEventData {
	readonly messageId: string;
	readonly deltaContent: string;
}
export interface AgentTaskAbortEventData {
	readonly reason: string;
}
export interface AgentTaskToolUserRequestedEventData {
	readonly toolCallId: string;
	readonly toolName: string;
	readonly arguments: unknown;
}
export interface AgentTaskToolExecutionStartEventData {
	readonly toolCallId: string;
	readonly toolName: string;
	readonly arguments: unknown;
	readonly parentToolCallId?: string;
}
export interface AgentTaskToolExecutionPartialResultEventData {
	readonly toolCallId: string;
	readonly partialOutput: string;
}
export interface AgentTaskToolExecutionCompleteEventResult {
	readonly content?: string;
	readonly detailedContent?: string;
}
export interface AgentTaskToolExecutionCompleteEventError {
	readonly message?: string;
	readonly code?: string;
}
export interface AgentTaskToolExecutionCompleteEventData {
	readonly toolCallId: string;
	readonly success: boolean;
	readonly isUserRequested?: boolean;
	readonly result?: AgentTaskToolExecutionCompleteEventResult;
	readonly error?: AgentTaskToolExecutionCompleteEventError;
	readonly toolTelemetry?: Record<string, unknown>;
	readonly parentToolCallId?: string;
}
export interface AgentTaskCustomAgentStartedEventData {
	readonly toolCallId: string;
	readonly agentName: string;
	readonly agentDisplayName: string;
	readonly agentDescription: string;
}
export interface AgentTaskCustomAgentCompletedEventData {
	readonly toolCallId: string;
	readonly agentName: string;
}
export interface AgentTaskCustomAgentFailedEventData {
	readonly toolCallId: string;
	readonly agentName: string;
	readonly error: string;
}
export interface AgentTaskCustomAgentSelectedEventData {
	readonly agentName: string;
	readonly agentDisplayName: string;
	readonly tools: readonly string[] | null;
}
export interface AgentTaskHookStartEventData {
	readonly hookInvocationId: string;
	readonly hookType: string;
	readonly input: unknown;
}
export interface AgentTaskHookEndEventError {
	readonly message?: string;
	readonly stack?: string;
}
export interface AgentTaskHookEndEventData {
	readonly hookInvocationId: string;
	readonly hookType: string;
	readonly output: unknown;
	readonly success: boolean;
	readonly error?: AgentTaskHookEndEventError;
}
export interface AgentTaskSystemMessageEventMetadata {
	readonly promptVersion?: string;
	readonly variables?: Record<string, unknown>;
}
export interface AgentTaskSystemMessageEventData {
	readonly content: string;
	readonly role: 'system' | 'developer';
	readonly name?: string;
	readonly metadata?: AgentTaskSystemMessageEventMetadata;
}
export interface AgentTaskPermissionRequestedEventData {
	readonly requestId: string;
	readonly permissionRequest: unknown;
}
export interface AgentTaskPermissionResult {
	/**
	 * Known values: `approved`, `denied-by-rules`, `denied-interactively-by-user`,
	 * `denied-no-approval-rule-and-could-not-request-from-user`,
	 * `denied-by-content-exclusion-policy`.
	 */
	readonly kind?: string;
}
export interface AgentTaskPermissionCompletedEventData {
	readonly requestId: string;
	readonly result?: AgentTaskPermissionResult;
	readonly toolCallId?: string;
}
export interface AgentTaskElicitationRequestedEventData {
	readonly requestId: string;
	readonly message: string;
	readonly requestedSchema: Record<string, unknown>;
	readonly toolCallId: string;
}
export interface AgentTaskElicitationCompletedEventData {
	readonly requestId: string;
	readonly action?: 'accept' | 'decline' | 'cancel';
	readonly content?: Record<string, unknown>;
}
export interface AgentTaskExitPlanModeRequestedEventData {
	readonly requestId: string;
	readonly toolCallId?: string;
	readonly summary: string;
	readonly planContent?: string;
	readonly actions?: readonly string[];
	readonly recommendedAction?: string;
}
export interface AgentTaskExitPlanModeCompletedEventData {
	readonly requestId: string;
	readonly approved?: boolean;
	readonly selectedAction?: string;
	readonly autoApproveEdits?: boolean;
	readonly feedback?: string;
}
/**
 * Spec: `SessionEvent` — discriminated union of every session event variant.
 * Narrow on `type` to access the strongly-typed `data` payload.
 */
export type AgentTaskSessionEvent =
	| (AgentTaskSessionEventBase & {
			readonly type: 'session.start';
			readonly data: AgentTaskSessionStartEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'session.resume';
			readonly data: AgentTaskSessionResumeEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'session.error';
			readonly data: AgentTaskSessionErrorEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'session.idle';
			readonly ephemeral: true;
			readonly data: AgentTaskSessionIdleEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'session.info';
			readonly data: AgentTaskSessionInfoEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'session.model_change';
			readonly data: AgentTaskSessionModelChangeEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'session.remote_steerable_changed';
			readonly data: AgentTaskSessionRemoteSteerableChangedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'session.import_legacy';
			readonly data: AgentTaskSessionImportLegacyEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'session.handoff';
			readonly data: AgentTaskSessionHandoffEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'session.truncation';
			readonly data: AgentTaskSessionTruncationEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'session.title_changed';
			readonly ephemeral: true;
			readonly data: AgentTaskSessionTitleChangedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'session.shutdown';
			readonly data: AgentTaskSessionShutdownEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'session.requested';
			readonly data: AgentTaskSessionRequestedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'user.message';
			readonly data: AgentTaskUserMessageEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'user_input.requested';
			readonly ephemeral: true;
			readonly data: AgentTaskUserInputRequestedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'user_input.completed';
			readonly data: AgentTaskUserInputCompletedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'assistant.turn_start';
			readonly data: AgentTaskAssistantTurnStartEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'assistant.intent';
			readonly ephemeral: true;
			readonly data: AgentTaskAssistantIntentEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'assistant.message';
			readonly data: AgentTaskAssistantMessageEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'assistant.turn_end';
			readonly data: AgentTaskAssistantTurnEndEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'assistant.usage';
			readonly ephemeral: true;
			readonly data: AgentTaskAssistantUsageEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'assistant.streaming_delta';
			readonly ephemeral: true;
			readonly data: AgentTaskAssistantStreamingDeltaEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'assistant.reasoning_delta';
			readonly ephemeral: true;
			readonly data: AgentTaskAssistantReasoningDeltaEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'assistant.message_delta';
			readonly ephemeral: true;
			readonly data: AgentTaskAssistantMessageDeltaEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'abort';
			readonly data: AgentTaskAbortEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'tool.user_requested';
			readonly data: AgentTaskToolUserRequestedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'tool.execution_start';
			readonly data: AgentTaskToolExecutionStartEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'tool.execution_partial_result';
			readonly ephemeral: true;
			readonly data: AgentTaskToolExecutionPartialResultEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'tool.execution_complete';
			readonly data: AgentTaskToolExecutionCompleteEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'custom_agent.started';
			readonly data: AgentTaskCustomAgentStartedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'custom_agent.completed';
			readonly data: AgentTaskCustomAgentCompletedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'custom_agent.failed';
			readonly data: AgentTaskCustomAgentFailedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'custom_agent.selected';
			readonly data: AgentTaskCustomAgentSelectedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'hook.start';
			readonly data: AgentTaskHookStartEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'hook.end';
			readonly data: AgentTaskHookEndEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'system.message';
			readonly data: AgentTaskSystemMessageEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'permission.requested';
			readonly data: AgentTaskPermissionRequestedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'permission.completed';
			readonly data: AgentTaskPermissionCompletedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'elicitation.requested';
			readonly ephemeral: true;
			readonly data: AgentTaskElicitationRequestedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'elicitation.completed';
			readonly data: AgentTaskElicitationCompletedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'exit_plan_mode.requested';
			readonly ephemeral: true;
			readonly data: AgentTaskExitPlanModeRequestedEventData;
	  })
	| (AgentTaskSessionEventBase & {
			readonly type: 'exit_plan_mode.completed';
			readonly data: AgentTaskExitPlanModeCompletedEventData;
	  });
/** Spec: `ListTaskEventsResponse`. */
export interface AgentTaskListEventsResponse {
	readonly events: readonly AgentTaskSessionEvent[];
	readonly total: number;
}
/** Spec: `CreatePullRequestResponse`. */
export interface AgentTaskCreatePullRequestResponse {
	readonly id: number;
	readonly number: number;
	readonly repository_id: number;
}
