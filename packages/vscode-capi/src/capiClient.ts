import { DefaultFetcherService } from './defaultFetcher';
import { DomainService } from './domainService';
import { LICENSE_AGREEMENT } from './licenseAgreement';
import {
	type CopilotToken,
	type IDomainChangeResponse,
	type IExtensionInformation,
	type IFetcherService,
	type MakeRequestOptions,
	type RequestMetadata,
	RequestType,
	type WebSocketConnectOptions,
} from './types';
import { createRequestHMAC, isCAPIRequest } from './utils';

type AgentTaskMetadata = Extract<
	RequestMetadata,
	{ type: RequestType.AgentTask }
>;

export class CAPIClient {
	private readonly _extensionInfo;
	private readonly _integrationId?;
	private readonly _domainService;
	private readonly _fetcherService;
	private readonly _hmacSecret;
	private _copilotSku: string | undefined;
	private _licenseCheckSucceeded;

	constructor(
		_extensionInfo: IExtensionInformation,
		_license: string | undefined,
		fetcherService?: IFetcherService,
		hmacSecret?: string,
		_integrationId?: string,
	) {
		this._extensionInfo = _extensionInfo;
		this._integrationId = _integrationId;

		if (_license && _license === LICENSE_AGREEMENT) {
			this._licenseCheckSucceeded = true;
		}

		this._domainService = new DomainService();
		this._fetcherService = fetcherService ?? new DefaultFetcherService();
		this._hmacSecret = hmacSecret;

		if (
			this._integrationId === 'vscode-chat' ||
			this._integrationId === 'code-oss'
		) {
			throw new Error(
				`Integration ID ${this._integrationId} is reserved and cannot be used.`,
			);
		}
	}

	updateDomains(
		copilotToken: CopilotToken | undefined,
		enterpriseUrlConfig: string | undefined,
	): IDomainChangeResponse {
		if (copilotToken?.sku) {
			this._copilotSku = copilotToken.sku;
		}
		return this._domainService.updateDomains(copilotToken, enterpriseUrlConfig);
	}

	async makeRequest<T>(
		requestOptions: MakeRequestOptions,
		requestMetadata: RequestMetadata,
	): Promise<T> {
		await this._mixinHeaders(requestOptions, requestMetadata);
		const finalRequestOptions = {
			...requestOptions,
			callSite: requestOptions.callSite ?? requestMetadata.type,
		};

		switch (requestMetadata.type) {
			case RequestType.CopilotToken:
				return this._fetcherService.fetch(
					this._domainService.tokenURL,
					finalRequestOptions,
				);
			case RequestType.CopilotNLToken:
				return this._fetcherService.fetch(
					this._domainService.tokenNoAuthURL,
					finalRequestOptions,
				);
			case RequestType.ProxyCompletions:
				return this._fetcherService.fetch(
					`${this._domainService.proxyBaseURL}/v1/engines/gpt-4o-copilot/completions`,
					finalRequestOptions,
				);
			case RequestType.ProxyChatCompletions:
				return this._fetcherService.fetch(
					`${this._domainService.proxyBaseURL}/chat/completions`,
					finalRequestOptions,
				);
			case RequestType.RemoteAgent:
				return this._fetcherService.fetch(
					this._domainService.remoteAgentsURL,
					finalRequestOptions,
				);
			case RequestType.CodeReviewAgent:
				return this._fetcherService.fetch(
					`${this._domainService.remoteAgentsURL}/github-code-review`,
					finalRequestOptions,
				);
			case RequestType.CAPIEmbeddings:
				return this._fetcherService.fetch(
					this._domainService.capiEmbeddingsURL,
					finalRequestOptions,
				);
			case RequestType.DotcomEmbeddings:
				return this._fetcherService.fetch(
					this._domainService.embeddingsURL,
					finalRequestOptions,
				);
			case RequestType.EmbeddingsModels:
				return this._fetcherService.fetch(
					this._domainService.embeddingsModelURL,
					finalRequestOptions,
				);
			case RequestType.Chunks:
				return this._fetcherService.fetch(
					this._domainService.chunksURL,
					finalRequestOptions,
				);
			case RequestType.EmbeddingsCodeSearch:
				return this._fetcherService.fetch(
					this._domainService.embeddingsCodeSearchURL,
					finalRequestOptions,
				);
			case RequestType.ListSkills:
				return this._fetcherService.fetch(
					this._domainService.listSkillsURL,
					finalRequestOptions,
				);
			case RequestType.Telemetry:
				return this._fetcherService.fetch(
					this._domainService.telemetryURL,
					finalRequestOptions,
				);
			case RequestType.CopilotUserInfo:
				return this._fetcherService.fetch(
					this._domainService.copilotUserInfoURL,
					finalRequestOptions,
				);
			case RequestType.SnippyMatch:
				return this._fetcherService.fetch(
					`${this._domainService.originTrackerURL}/twirp/github.snippy.v1.SnippyAPI/Match`,
					finalRequestOptions,
				);
			case RequestType.SnippyFilesForMatch:
				return this._fetcherService.fetch(
					`${this._domainService.originTrackerURL}/twirp/github.snippy.v1.SnippyAPI/FilesForMatch`,
					finalRequestOptions,
				);
			case RequestType.EmbeddingsIndex:
				if (requestMetadata.repoWithOwner === null) {
					throw new Error(
						'repoWithOwner is required for EmbeddingsIndex request',
					);
				}
				return this._fetcherService.fetch(
					`${this._domainService.dotComAPIURL}/repos/${requestMetadata.repoWithOwner}/copilot_internal/embeddings_index`,
					finalRequestOptions,
				);
			case RequestType.CodingGuidelines:
				if (requestMetadata.repoWithOwner === null) {
					throw new Error(
						'repoWithOwner is required for CodingGuidelines request',
					);
				}
				return this._fetcherService.fetch(
					`${this._domainService.dotComAPIURL}/repos/${requestMetadata.repoWithOwner}/copilot_internal/coding_guidelines`,
					finalRequestOptions,
				);
			case RequestType.AutoModels:
				return this._fetcherService.fetch(
					this._domainService.capiAutoModelURL,
					finalRequestOptions,
				);
			case RequestType.ModelRouter:
				return this._fetcherService.fetch(
					this._domainService.capiModelRouterURL,
					finalRequestOptions,
				);
			case RequestType.Auto:
				return this._fetcherService.fetch(
					this._domainService.capiAutoURL,
					finalRequestOptions,
				);
			case RequestType.Models:
				if (requestMetadata.isModelLab) {
					return this._fetcherService.fetch(
						`${DomainService.CAPI_MODEL_LAB_URL}/models`,
						finalRequestOptions,
					);
				} else {
					return this._fetcherService.fetch(
						this._domainService.capiModelsURL,
						finalRequestOptions,
					);
				}
			case RequestType.ChatCompletions:
				if (requestMetadata.isModelLab) {
					return this._fetcherService.fetch(
						`${DomainService.CAPI_MODEL_LAB_URL}/chat/completions`,
						finalRequestOptions,
					);
				} else {
					return this._fetcherService.fetch(
						this._domainService.capiChatURL,
						finalRequestOptions,
					);
				}
			case RequestType.ChatResponses:
				if (requestMetadata.isModelLab) {
					return this._fetcherService.fetch(
						`${DomainService.CAPI_MODEL_LAB_URL}/responses`,
						finalRequestOptions,
					);
				} else {
					return this._fetcherService.fetch(
						this._domainService.capiResponsesURL,
						finalRequestOptions,
					);
				}
			case RequestType.ChatMessages:
				if (requestMetadata.isModelLab) {
					return this._fetcherService.fetch(
						`${DomainService.CAPI_MODEL_LAB_URL}/v1/messages`,
						finalRequestOptions,
					);
				} else {
					return this._fetcherService.fetch(
						this._domainService.capiMessagesURL,
						finalRequestOptions,
					);
				}
			case RequestType.ContentExclusion:
				if (requestMetadata.repos === null) {
					throw new Error('Repos are required for ContentExclusion request');
				}
				return this._fetcherService.fetch(
					this._prepareContentExclusionUrl(requestMetadata.repos),
					finalRequestOptions,
				);
			case RequestType.RemoteAgentChat:
				if (requestMetadata.slug) {
					return this._fetcherService.fetch(
						`${this._domainService.remoteAgentsURL}/${requestMetadata.slug}?chat`,
						finalRequestOptions,
					);
				} else {
					return this._fetcherService.fetch(
						`${this._domainService.remoteAgentsURL}/chat`,
						finalRequestOptions,
					);
				}
			case RequestType.SearchSkill:
				if (requestMetadata.slug === null) {
					throw new Error('Skill slug is required for SearchSkill request');
				}
				return this._fetcherService.fetch(
					`${this._domainService.searchSkillURL}/${requestMetadata.slug}`,
					finalRequestOptions,
				);
			case RequestType.ModelPolicy:
				if (requestMetadata.modelId === null) {
					throw new Error('Model ID is required for ModelPolicy request');
				}
				return this._fetcherService.fetch(
					`${this._domainService.capiModelsURL}/${requestMetadata.modelId}/policy`,
					finalRequestOptions,
				);
			case RequestType.ListModel:
				if (requestMetadata.modelId === null) {
					throw new Error('Model ID is required for ListModel request');
				}
				return this._fetcherService.fetch(
					`${this._domainService.capiModelsURL}/${requestMetadata.modelId}`,
					finalRequestOptions,
				);
			case RequestType.ChatAttachmentUpload:
				if (
					requestMetadata.uploadName === null ||
					requestMetadata.mimeType === null
				) {
					throw new Error(
						'uploadName and mimeType are required for ChatAttachmentUpload request',
					);
				}
				return this._fetcherService.fetch(
					`${this._domainService.chatAttachmentUploadURL}?name=${requestMetadata.uploadName}&content_type=${requestMetadata.mimeType}`,
					finalRequestOptions,
				);
			case RequestType.CopilotSessionLogs:
				if (requestMetadata.sessionId === null) {
					throw new Error(
						'sessionId is required for CopilotSessionLogs request',
					);
				}
				return this._fetcherService.fetch(
					`${this._domainService.copilotAgentSessionsURL}/${requestMetadata.sessionId}/logs`,
					finalRequestOptions,
				);
			case RequestType.CopilotSessionDetails:
				if (requestMetadata.sessionId === null) {
					throw new Error(
						'sessionId is required for CopilotSessionDetails request',
					);
				}
				return this._fetcherService.fetch(
					`${this._domainService.copilotAgentSessionsURL}/${requestMetadata.sessionId}`,
					finalRequestOptions,
				);
			case RequestType.CopilotSessions: {
				const paginationOptions = {
					...finalRequestOptions,
					getItemsFromResponse: (data: any) => {
						return data && Array.isArray(data.sessions) ? data.sessions : [];
					},
					buildUrl: (baseUrl: string, pageSize: number, page: number) => {
						const url = new URL(baseUrl);
						url.searchParams.set('page_size', pageSize.toString());
						url.searchParams.set('page_number', page.toString());

						if (requestMetadata.resourceState) {
							url.searchParams.set(
								'resource_state',
								requestMetadata.resourceState,
							);
						}

						if (requestMetadata.nwo) {
							url.searchParams.set('repo_nwo', requestMetadata.nwo);
						}

						return url.toString();
					},
				};

				if (requestMetadata.prId) {
					return this._fetcherService.fetch(
						`${this._domainService.copilotAgentSessionsURL}/resource/pull/${requestMetadata.prId}`,
						finalRequestOptions,
					);
				}

				return this._fetcherService.fetchWithPagination(
					this._domainService.copilotAgentSessionsURL,
					paginationOptions,
				) as Promise<T>;
			}
			case RequestType.CopilotAgentJob:
				if (requestMetadata.owner === null || requestMetadata.repo === null) {
					throw new Error(
						'owner and repo are required for CopilotAgentJob request',
					);
				}
				if (requestMetadata.jobId) {
					const version = requestMetadata.apiVersion ?? 'v1';
					return this._fetcherService.fetch(
						`${this._domainService.copilotAgentJobsURL}/${version}/jobs/${requestMetadata.owner}/${requestMetadata.repo}/${requestMetadata.jobId}`,
						finalRequestOptions,
					);
				}
				if (requestMetadata.sessionId) {
					const version = requestMetadata.apiVersion ?? 'v1';
					return this._fetcherService.fetch(
						`${this._domainService.copilotAgentJobsURL}/${version}/jobs/${requestMetadata.owner}/${requestMetadata.repo}/session/${requestMetadata.sessionId}`,
						finalRequestOptions,
					);
				}
				if (requestMetadata.payload) {
					const version = requestMetadata.apiVersion ?? 'v1';
					return this._fetcherService.fetch(
						`${this._domainService.copilotAgentJobsURL}/${version}/jobs/${requestMetadata.owner}/${requestMetadata.repo}`,
						finalRequestOptions,
					);
				}
				throw new Error(
					'jobId or sessionId is required for CopilotAgentJob request',
				);
			case RequestType.CCAModelsList:
				return this._fetcherService.fetch(
					this._domainService.CCAModelsURL,
					finalRequestOptions,
				);
			case RequestType.CopilotCustomAgents: {
				const { owner, repo } = requestMetadata;

				if (owner === null || repo === null) {
					throw new Error(
						'owner and repo are required for CopilotCustomAgents request',
					);
				}

				const url = new URL(
					`${this._domainService.copilotCustomAgentsURL}/${owner}/${repo}`,
				);

				const { target, exclude_invalid_config, dedupe, include_sources } =
					requestMetadata;

				if (target) {
					url.searchParams.set('target', target);
				}

				if (exclude_invalid_config !== null) {
					url.searchParams.set(
						'exclude_invalid_config',
						String(exclude_invalid_config),
					);
				}

				if (dedupe !== null) {
					url.searchParams.set('dedupe', String(dedupe));
				}

				if (include_sources?.length) {
					url.searchParams.set('include_sources', include_sources.join(','));
				}

				return this._fetcherService.fetch(url.toString(), finalRequestOptions);
			}
			case RequestType.CopilotCustomAgentsDetail: {
				if (
					requestMetadata.owner === null ||
					requestMetadata.repo === null ||
					requestMetadata.customAgentName === null
				) {
					throw new Error(
						'owner, repo and customAgentName are required for CopilotCustomAgents request',
					);
				}
				const url = new URL(
					`${this._domainService.copilotCustomAgentsURL}/${requestMetadata.owner}/${requestMetadata.repo}/${requestMetadata.customAgentName}`,
				);

				if (requestMetadata.version) {
					url.searchParams.set('version', requestMetadata.version);
				}

				return this._fetcherService.fetch(url.toString(), finalRequestOptions);
			}
			case RequestType.OrgCustomInstructions:
				if (requestMetadata.orgLogin === null) {
					throw new Error(
						'orgLogin is required for OrgCustomInstructions request',
					);
				}
				return this._fetcherService.fetch(
					`${this._domainService.dotComAPIURL}/copilot_internal/org_custom_instructions/${requestMetadata.orgLogin}`,
					finalRequestOptions,
				);
			case RequestType.CopilotAgentMemory: {
				const { repo } = requestMetadata;

				if (repo === null) {
					throw new Error('repo is required for CopilotAgentMemory request');
				}

				const url = new URL(
					`${this._domainService.copilotAgentMemoryURL}/${repo}`,
				);

				const action = requestMetadata.action ?? '';

				if (action) {
					url.pathname += `/${action}`;
				}

				if (action === 'recent' && requestMetadata.limit !== null) {
					url.searchParams.set('limit', String(requestMetadata.limit));
				}

				return this._fetcherService.fetch(url.toString(), finalRequestOptions);
			}
			case RequestType.CopilotAgentJobEnabled: {
				if (requestMetadata.owner === null || requestMetadata.repo === null) {
					throw new Error(
						'owner and repo are required for CopilotAgentJobEnabled request',
					);
				}
				return this._fetcherService.fetch(
					`${this._domainService.copilotAgentJobsURL}/v1/jobs/${requestMetadata.owner}/${requestMetadata.repo}/enabled`,
					finalRequestOptions,
				);
			}
			case RequestType.AgentTask: {
				return this._fetcherService.fetch(
					this._buildAgentTaskURL(requestMetadata as AgentTaskMetadata),
					finalRequestOptions,
				);
			}
			default:
				throw new Error(
					`Unsupported request type: ${
						(requestMetadata as any).type // eslint-disable-line local/code-no-any-casts
					}`,
				);
		}
	}

	private _buildAgentTaskURL(requestMetadata: AgentTaskMetadata) {
		const baseUrl = this._domainService.copilotAgentTasksURL;
		const { action, owner, repo, taskId, searchParams } = requestMetadata;

		const requireTaskId = () => {
			if (!taskId) {
				throw new Error(`taskId is required for AgentTask action "${action}"`);
			}
			return taskId;
		};

		const requireRepoInfo = () => {
			if (!owner || !repo) {
				throw new Error(
					`owner and repo are required for AgentTask action "${action}"`,
				);
			}
			return { owner, repo };
		};

		let path: string;

		switch (action) {
			case 'create': {
				const repoInfo = requireRepoInfo();
				path = `/repos/${repoInfo.owner}/${repoInfo.repo}/tasks`;
				break;
			}
			case 'list':
				path = '/tasks';
				break;
			case 'list-for-repo': {
				const repoInfo = requireRepoInfo();
				path = `/repos/${repoInfo.owner}/${repoInfo.repo}/tasks`;
				break;
			}
			case 'get':
				path = `/tasks/${requireTaskId()}`;
				break;
			case 'events':
				path = `/tasks/${requireTaskId()}/events`;
				break;
			case 'steer':
				path = `/tasks/${requireTaskId()}/steer`;
				break;
			case 'create-pr': {
				const repoInfo = requireRepoInfo();
				path = `/repos/${repoInfo.owner}/${repoInfo.repo}/tasks/${requireTaskId()}/pulls`;
				break;
			}
			case 'archive':
				path = `/tasks/${requireTaskId()}/archive`;
				break;
			case 'unarchive':
				path = `/tasks/${requireTaskId()}/unarchive`;
				break;
			default: {
				const unsupportedAction = action;
				throw new Error(`Unsupported AgentTask action: ${unsupportedAction}`);
			}
		}

		let fullUrl = `${baseUrl}${path}`;

		if (searchParams) {
			const urlParams = new URLSearchParams();

			for (const [key, value] of Object.entries(searchParams)) {
				if (value !== null) {
					urlParams.set(key, String(value));
				}
			}

			const queryString = urlParams.toString();
			if (queryString) {
				fullUrl += `?${queryString}`;
			}
		}

		return fullUrl;
	}

	async createResponsesWebSocket(request: WebSocketConnectOptions) {
		await this._mixinHeaders(request, { type: RequestType.ChatResponses });

		return this._fetcherService.createWebSocket(
			this._domainService.capiResponsesURL,
			request,
		);
	}

	private _prepareContentExclusionUrl(repos: string[]) {
		const url = new URL(this._domainService.contentExclusionURL);
		const reposParam = repos.join(',');

		if (repos.length > 0) {
			url.searchParams.set('repos', reposParam);
		}
		url.searchParams.set('scope', 'repo');
		return url.toString();
	}

	private async _mixinHeaders(
		requestOptions: WebSocketConnectOptions,
		requestMetadata: RequestMetadata,
	) {
		if (!isCAPIRequest(requestMetadata.type)) {
			return;
		}

		const headers = requestOptions.headers || {};

		headers['X-GitHub-Api-Version'] = '2026-08-01';
		headers['VScode-SessionId'] = this._extensionInfo.sessionId;
		headers['VScode-MachineId'] = this._extensionInfo.machineId;
		headers['Editor-Device-Id'] = this._extensionInfo.deviceId;
		headers['Editor-Plugin-Version'] =
			`copilot-chat/${this._extensionInfo.version}`;
		headers['Editor-Version'] = `vscode/${this._extensionInfo.vscodeVersion}`;

		let integrationId = '';

		if (!requestOptions.suppressIntegrationId) {
			integrationId = 'code-oss';

			if (this._integrationId && this._hmacSecret) {
				integrationId = this._integrationId;
			} else if (this._copilotSku === 'no_auth_limited_copilot') {
				integrationId = 'vscode-nl';
			} else if (
				this._licenseCheckSucceeded &&
				this._extensionInfo.buildType === 'prod'
			) {
				integrationId = 'vscode-chat';
			} else if (this._extensionInfo.buildType === 'dev' && this._hmacSecret) {
				integrationId = 'vscode-chat-dev';
			}

			headers['Copilot-Integration-Id'] = integrationId;
		}

		if (integrationId === 'vscode-chat-dev') {
			const hmac = await createRequestHMAC(this._hmacSecret);
			if (hmac !== undefined) {
				headers['Request-Hmac'] = hmac;
			}
		}

		requestOptions.headers = headers;
	}

	get copilotTelemetryURL() {
		return this._domainService.telemetryURL;
	}
	get dotcomAPIURL() {
		return this._domainService.dotComAPIURL;
	}
	get capiPingURL() {
		return `${this._domainService.capiBaseURL}/_ping`;
	}
	get proxyBaseURL() {
		return this._domainService.proxyBaseURL;
	}
	get originTrackerURL() {
		return this._domainService.originTrackerURL;
	}
	get snippyMatchPath() {
		return 'twirp/github.snippy.v1.SnippyAPI/Match';
	}
	get snippyFilesForMatchPath() {
		return 'twirp/github.snippy.v1.SnippyAPI/FilesForMatch';
	}
}
