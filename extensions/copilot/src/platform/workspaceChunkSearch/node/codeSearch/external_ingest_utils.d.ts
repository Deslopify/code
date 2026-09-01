export namespace ingestUtils {
    /* tslint:disable */
    /* eslint-disable */
    /**
     * This version is bumped if there is a change in this wasm library that should invalidate any cached data.
     */
    export function cacheVersion(): number;
    export function canIngestPathAndSize(
        filter: IngestFilter,
        path: string,
        size: number,
    ): IngestFilterResult;
    export function getDocShaFromContentSha(
        path: string,
        content_sha: ContentSha,
    ): any;
    export function canIngestPath(
        filter: IngestFilter,
        path: string,
    ): IngestFilterResult;
    export function canIngestSize(
        filter: IngestFilter,
        size: number,
    ): IngestFilterResult;
    export function createCodedSymbols(
        doc_shas: Uint8Array[],
        range_start: number,
        range_end: number,
    ): Uint8Array[];
    export function canIngestDocument(
        filter: IngestFilter,
        path: string,
        content: DocumentContents,
    ): IngestFilterResult;
    export function setupPanicHooks(): void;
    export function getDocSha(path: string, content: DocumentContents): any;
    /**
     * A handle to a content SHA (binary representation).
     */
    export class ContentSha {
        private constructor();
        free(): void;
        [Symbol.dispose](): void;
    }
    /**
     * A handle to some content to minimise the number of copies we need
     * to make from JavaScript to WASM memory.
     */
    export class DocumentContents {
        free(): void;
        [Symbol.dispose](): void;
        constructor(content: Uint8Array);
    }
    export class GeoFilter {
        free(): void;
        [Symbol.dispose](): void;
        constructor();
        push(doc_sha: Uint8Array): void;
        toBytes(): Uint8Array;
    }
    export class IngestFilter {
        free(): void;
        [Symbol.dispose](): void;
        constructor();
    }
    export class IngestFilterResult {
        private constructor();
        free(): void;
        [Symbol.dispose](): void;
        get failureReason(): string | undefined
        set failureReason(value: string | null | undefined)
    }
}
