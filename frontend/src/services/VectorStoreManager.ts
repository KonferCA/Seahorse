export type SearchResult = {
    pageContent: string;
    metadata: Record<string, any>;
    score?: number;
};

export class VectorStoreManager {
    private worker: Worker;

    constructor() {
        this.worker = new Worker(new URL('./vectorStoreWorker.ts', import.meta.url));
    }

    async embedTexts(texts: string[]): Promise<number> {
        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent) => {
                const { type, data, error } = event.data;
                if (type === 'EMBED_COMPLETE') {
                    this.worker.removeEventListener('message', handler);
                    resolve(data.count);
                } else if (type === 'ERROR') {
                    this.worker.removeEventListener('message', handler);
                    reject(new Error(error));
                }
            };

            this.worker.addEventListener('message', handler);
            this.worker.postMessage({
                type: 'EMBED_TEXTS',
                data: texts
            });
        });
    }

    async searchSimilar(query: string, k: number): Promise<SearchResult[]> {
        return new Promise((resolve, reject) => {
            const handler = (event: MessageEvent) => {
                const { type, data, error } = event.data;
                if (type === 'SEARCH_COMPLETE') {
                    this.worker.removeEventListener('message', handler);
                    resolve(data.results);
                } else if (type === 'ERROR') {
                    this.worker.removeEventListener('message', handler);
                    reject(new Error(error));
                }
            };

            this.worker.addEventListener('message', handler);
            this.worker.postMessage({
                type: 'SEARCH',
                data: { query, k }
            });
        });
    }

    terminate() {
        this.worker.terminate();
    }
}
