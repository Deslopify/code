import type {
	FetchOptions,
	IFetcherService,
	MakeRequestOptions,
	PaginationOptions,
	WebSocketConnectOptions,
} from './types';
export class DefaultFetcherService implements IFetcherService {
	async fetch(url: string, options: FetchOptions) {
		const request: MakeRequestOptions = {
			method: options.method || 'GET',
			headers: options.headers,
			signal: options.signal,
		};

		if (options.json) {
			request.body = JSON.stringify(options.json);

			request.headers = {
				'Content-Type': 'application/json',
				...request.headers,
			};
		} else if (options.body) {
			request.body = options.body;
		}

		let timeout: number | undefined;
		let abortController: AbortController;

		if (options.timeout && !options.signal) {
			abortController = new AbortController();
			request.signal = abortController.signal;

			timeout = setTimeout(() => {
				abortController.abort();
			}, options.timeout);
		}

		try {
			const response = await fetch(url, request as RequestInit);

			if (timeout) {
				clearTimeout(timeout);
			}

			return response;
		} catch (error) {
			if (timeout) {
				clearTimeout(timeout);
			}

			throw error;
		}
	}
	async fetchWithPagination<T>(
		baseUrl: string,
		options: PaginationOptions<T>,
	): Promise<T[]> {
		const results = [];
		const pageSize = options.pageSize ?? 20;
		let page = options.startPage ?? 1;
		let hasMore = false;

		do {
			const url = options.buildUrl(baseUrl, pageSize, page),
				res = await this.fetch(url, options);
			if (!res.ok) {
				return results;
			}

			const data = await res.json();
			const items = options.getItemsFromResponse(data);

			results.push(...items);
			hasMore = items.length === pageSize;
			page++;
		} while (hasMore);

		return results;
	}
	createWebSocket(
		url: string,
		_options?: WebSocketConnectOptions,
	): {
		webSocket: WebSocket;
	} {
		return { webSocket: new WebSocket(url) };
	}
}
