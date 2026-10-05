import type { RequestType } from './types';

export async function createRequestHMAC(
	hmacSecret: string | undefined,
): Promise<string | undefined> {
	if (!hmacSecret) {
		return;
	}

	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(hmacSecret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign'],
	);

	const timestamp = Math.floor(Date.now() / 1000).toString();
	const data = new TextEncoder().encode(timestamp);

	const signatureBuffer = await crypto.subtle.sign('HMAC', key, data);

	const signatureHex = Array.from(new Uint8Array(signatureBuffer))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');

	return `${timestamp}.${signatureHex}`;
}

export function isCAPIRequest(requestType: RequestType) {
	return new Set([
		'ChatCompletions',
		'ChatResponses',
		'ChatMessages',
		'CAPIEmbeddings',
		'Models',
		'RemoteAgent',
		'CodeReviewAgent',
		'RemoteAgentChat',
		'ListSkills',
		'SearchSkill',
		'ModelPolicy',
		'ListModel',
		'AutoModels',
		'CopilotSessionLogs',
		'CopilotSessionDetails',
		'CopilotSessions',
		'CopilotAgentJob',
		'CCAModelsList',
		'CopilotCustomAgents',
		'CopilotAgentMemory',
		'ModelRouter',
		'Auto',
	]).has(requestType);
}
