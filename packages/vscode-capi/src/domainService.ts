import type { CopilotToken, IDomainChangeResponse } from './types';
/**
 * Very simple service used for dynamically setting the domains we use for API calls
 * This allows better testing, SKU isolation, and Proxima
 */
export interface IDomainService {
	readonly capiBaseURL: string;
	readonly proxyBaseURL: string;
	readonly capiChatURL: string;
	readonly capiResponsesURL: string;
	readonly capiMessagesURL: string;
	readonly capiEmbeddingsURL: string;
	readonly capiModelsURL: string;
	readonly capiAutoModelURL: string;
	readonly capiModelRouterURL: string;
	readonly chunksURL: string;
	readonly embeddingsURL: string;
	readonly embeddingsModelURL: string;
	readonly embeddingsCodeSearchURL: string;
	readonly remoteAgentsURL: string;
	readonly listSkillsURL: string;
	readonly searchSkillURL: string;
	readonly contentExclusionURL: string;
	readonly telemetryURL: string;
	readonly tokenURL: string;
	readonly tokenNoAuthURL: string;
	readonly copilotUserInfoURL: string;
	readonly dotComAPIURL: string;
	/**
	 * Snippy API base URL
	 */
	readonly originTrackerURL: string;
	readonly chatAttachmentUploadURL: string;
	readonly copilotAgentSessionsURL: string;
	readonly copilotAgentJobsURL: string;
	readonly CCAModelsURL: string;
	readonly copilotCustomAgentsURL: string;
	readonly copilotAgentMemoryURL: string;
	updateDomains(
		copilotToken: CopilotToken | undefined,
		enterpriseUrlConfig: string | undefined,
	): IDomainChangeResponse;
}

export class DomainService implements IDomainService {
	private static DEFAULT_PROXY_BASE_URL =
		'https://copilot-proxy.githubusercontent.com';
	static CAPI_MODEL_LAB_URL = 'https://api-model-lab.githubcopilot.com';
	private _dotcomAPIUrl;
	private _proxyBaseUrl;
	private _capiBaseUrl;
	private _enterpriseUrlConfig: string | undefined;
	private _telemetryBaseUrl;
	private _originTrackerUrl;
	constructor() {
		this._telemetryBaseUrl = 'https://copilot-telemetry.githubusercontent.com';
		this._originTrackerUrl = 'https://origin-tracker.githubusercontent.com';
		this._dotcomAPIUrl = this._getDotComAPIUrl();
		this._proxyBaseUrl = this._getProxyUrl(undefined);
		this._capiBaseUrl = this._getCAPIUrl(undefined);
	}

	updateDomains(
		copilotToken: CopilotToken | undefined,
		enterpriseUrlConfig: string | undefined,
	): IDomainChangeResponse {
		const dotcomAPIUrl = this._dotcomAPIUrl;
		const capiBaseUrl = this._capiBaseUrl;
		const telemetryBaseUrl = this._telemetryBaseUrl;
		const proxyBaseUrl = this._proxyBaseUrl;

		if (this._enterpriseUrlConfig !== enterpriseUrlConfig) {
			this._enterpriseUrlConfig = enterpriseUrlConfig;
			this._dotcomAPIUrl = this._getDotComAPIUrl();
		}

		if (copilotToken) {
			this._proxyBaseUrl = this._getProxyUrl(copilotToken);
			this._capiBaseUrl = this._getCAPIUrl(copilotToken);
			this._telemetryBaseUrl =
				copilotToken.endpoints.telemetry ||
				'https://copilot-telemetry.githubusercontent.com';

			if (copilotToken.endpoints['origin-tracker']) {
				this._originTrackerUrl = copilotToken.endpoints['origin-tracker'];
			}
		} else {
			this._capiBaseUrl = 'https://api.githubcopilot.com';
			this._telemetryBaseUrl =
				'https://copilot-telemetry.githubusercontent.com';
		}

		return {
			dotcomUrlChanged: dotcomAPIUrl !== this._dotcomAPIUrl,
			capiUrlChanged: capiBaseUrl !== this._capiBaseUrl,
			telemetryUrlChanged: telemetryBaseUrl !== this._telemetryBaseUrl,
			proxyUrlChanged: proxyBaseUrl !== this._proxyBaseUrl,
		};
	}

	/**
	 * Resolves the dotcom api url to use, taking into account the enterprise url config and the auth provider
	 * @returns The dotcom api url
	 */
	private _getDotComAPIUrl() {
		if (this._enterpriseUrlConfig) {
			try {
				const url = new URL(this._enterpriseUrlConfig);
				return `${url.protocol}//api.${url.hostname}${url.port ? `:${url.port}` : ''}`;
			} catch (error) {
				console.warn(
					'Failed to parse enterprise URL config:',
					this._enterpriseUrlConfig,
					error,
				);
				return 'https://api.github.com';
			}
		}
		return 'https://api.github.com';
	}

	/**
	 * Resolves the CAPI url to use, taking into account the token and the config
	 * @param token The copilot token
	 * @returns The CAPI url to use
	 */
	private _getCAPIUrl(token: CopilotToken | undefined) {
		return token?.endpoints?.api || 'https://api.githubcopilot.com';
	}

	private _getProxyUrl(token: CopilotToken | undefined) {
		return token?.endpoints?.proxy || DomainService.DEFAULT_PROXY_BASE_URL;
	}

	get proxyBaseURL() {
		return this._proxyBaseUrl;
	}
	get capiBaseURL() {
		return this._capiBaseUrl;
	}
	get capiChatURL() {
		return `${this._capiBaseUrl}/chat/completions`;
	}
	get capiResponsesURL() {
		return `${this._capiBaseUrl}/responses`;
	}
	get capiMessagesURL() {
		return `${this._capiBaseUrl}/v1/messages`;
	}
	get capiEmbeddingsURL() {
		return `${this._capiBaseUrl}/embeddings`;
	}
	get capiModelsURL() {
		return `${this._capiBaseUrl}/models`;
	}
	get capiAutoModelURL() {
		return `${this.capiModelsURL}/session`;
	}
	get capiModelRouterURL() {
		return `${this.capiAutoModelURL}/intent`;
	}
	get capiAutoURL() {
		return `${this._capiBaseUrl}/auto`;
	}
	get embeddingsModelURL() {
		return `${this.embeddingsURL}/models`;
	}
	get chunksURL() {
		return `${this.dotComAPIURL}/chunks`;
	}
	get embeddingsURL() {
		return `${this.dotComAPIURL}/embeddings`;
	}
	get embeddingsCodeSearchURL() {
		return `${this.dotComAPIURL}/embeddings/code/search`;
	}
	get telemetryURL() {
		return `${this._telemetryBaseUrl}/telemetry`;
	}
	get remoteAgentsURL() {
		return `${this._capiBaseUrl}/agents`;
	}
	get listSkillsURL() {
		return `${this._capiBaseUrl}/skills`;
	}
	get searchSkillURL() {
		return `${this._capiBaseUrl}/search`;
	}
	get contentExclusionURL() {
		return `${this._dotcomAPIUrl}/copilot_internal/content_exclusion`;
	}
	get copilotUserInfoURL() {
		return `${this._dotcomAPIUrl}/copilot_internal/user`;
	}
	get tokenURL() {
		return `${this._dotcomAPIUrl}/copilot_internal/v2/token`;
	}
	get tokenNoAuthURL() {
		return `${this._dotcomAPIUrl}/copilot_internal/v2/nltoken`;
	}
	get dotComAPIURL() {
		return this._dotcomAPIUrl;
	}
	get originTrackerURL() {
		return this._originTrackerUrl;
	}
	get chatAttachmentUploadURL() {
		return 'https://uploads.github.com/copilot/chat/attachments';
	}
	get copilotAgentSessionsURL() {
		return `${this._capiBaseUrl}/agents/sessions`;
	}
	get copilotAgentJobsURL() {
		return `${this._capiBaseUrl}/agents/swe`;
	}
	get copilotAgentTasksURL() {
		return `${this._dotcomAPIUrl}/cmc_internal/api/agents`;
	}
	get CCAModelsURL() {
		return `${this._capiBaseUrl}/agents/swe/models`;
	}
	get copilotCustomAgentsURL() {
		return `${this._capiBaseUrl}/agents/swe/custom-agents`;
	}
	get copilotAgentMemoryURL() {
		return `${this._capiBaseUrl}/agents/swe/internal/memory/v0`;
	}
}
