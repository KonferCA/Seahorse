import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
import { VoyVectorStore } from '@langchain/community/vectorstores/voy';
import { Document } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Voy as VoyClient } from 'voy-search';

class VectorStoreWorker {
    private vectorStore: VoyVectorStore | null = null;
    private embeddings: HuggingFaceTransformersEmbeddings | null = null;
    private textSplitter: RecursiveCharacterTextSplitter | null = null;
    private voyClient: VoyClient | null = null;

    async initialize() {
        if (!this.embeddings || !this.textSplitter || !this.voyClient) {
            this.embeddings = new HuggingFaceTransformersEmbeddings({
                modelName: 'Xenova/all-MiniLM-L6-v2',
            });
            this.textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 500,
                chunkOverlap: 50,
            });
            this.voyClient = new VoyClient();
            this.vectorStore = new VoyVectorStore(
                this.voyClient,
                this.embeddings
            );
        }
    }

    async embedTexts(texts: string[]): Promise<number> {
        try {
            await this.initialize();
            const rawDocuments = texts.map(
                (text) =>
                    new Document({
                        pageContent: text,
                        metadata: { source: 'browser-data' },
                    })
            );
            const documents = await this.textSplitter!.splitDocuments(rawDocuments);
            if (this.vectorStore !== null) {
                await this.vectorStore.addDocuments(documents);
            }
            return documents.length;
        } catch (error) {
                throw new Error(`Failed to embed texts: ${(error as Error).message}`);
        }
    }

    async searchSimilar(query: string, k: number) {
        if (!this.vectorStore) {
            throw new Error('No documents have been embedded yet');
        }
        return this.vectorStore.similaritySearch(query, k);
    }
}

// Create worker instance
const worker = new VectorStoreWorker();

// Handle messages from main thread
self.onmessage = async (event) => {
    const { type, data } = event.data;

    try {
        switch (type) {
            case 'EMBED_TEXTS':
                const count = await worker.embedTexts(data);
                self.postMessage({
                    type: 'EMBED_COMPLETE',
                    data: { count }
                });
                break;

            case 'SEARCH':
                const results = await worker.searchSimilar(data.query, data.k);
                self.postMessage({
                    type: 'SEARCH_COMPLETE',
                    data: { results }
                });
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        self.postMessage({
            type: 'ERROR',
            error: (error as Error).message
        });
    }
};

// Prevent TS error about self
export {};
