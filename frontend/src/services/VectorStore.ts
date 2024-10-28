import localforage from 'localforage';

export interface Document {
    text: string;
    metadata: Record<any, any>;
}

export interface ChunkMetadata extends Record<any, any> {
    chunk: string;
    docId: number;
    chunkIndex: number;
}

export class VectorStore {
    public initialized: boolean;
    public chunkSize: number;
    public chunkOverlap: number;
    public store: LocalForage;

    constructor() {
        this.initialized = false;
        this.chunkSize = 100;
        this.chunkOverlap = 20;
        this.store = localforage.createInstance({
            name: 'vector-this.store',
            version: 1.0,
        });
    }

    async initialize() {
        if (this.initialized) return;
        await Promise.all([
            this.store.setItem('vectors', []),
            this.store.setItem('metadata', []),
            this.store.setItem('documents', []),
        ]);
        this.initialized = true;
        console.log('Vector this.store initialized');
    }

    chunkText(text: string) {
        const sections = text.split(/Section \d+:/);
        const chunks: string[] = [];

        sections.forEach((section) => {
            if (!section.trim()) return;

            const sentences = section.match(/[^.!?]+[.!?]+/g) || [section];
            let currentChunk: string[] = [];
            let currentLength = 0;

            sentences.forEach((sentence) => {
                const words = sentence.trim().split(' ');
                if (currentLength + words.length <= this.chunkSize) {
                    currentChunk.push(sentence.trim());
                    currentLength += words.length;
                } else {
                    if (currentChunk.length > 0) {
                        chunks.push(currentChunk.join(' '));
                    }
                    currentChunk = [sentence.trim()];
                    currentLength = words.length;
                }
            });

            if (currentChunk.length > 0) {
                chunks.push(currentChunk.join(' '));
            }
        });

        return chunks;
    }

    async addDocument(text: string, metadata = {}) {
        if (!this.initialized) await this.initialize();

        const chunks = this.chunkText(text);
        const documents =
            (await this.store.getItem<Document[]>('documents')) || [];
        const existingMetadata =
            (await this.store.getItem<ChunkMetadata[]>('metadata')) || [];

        const docId = documents.length;
        documents.push({ text, metadata });

        for (let i = 0; i < chunks.length; i++) {
            existingMetadata.push({
                chunk: chunks[i],
                docId,
                chunkIndex: i,
                ...metadata,
            });
        }

        await this.store.setItem('documents', documents);
        await this.store.setItem('metadata', existingMetadata);
        console.log(`Added document ${docId} with ${chunks.length} chunks`);
        return docId;
    }

    async addEmbedding(embedding: number[], docId: number) {
        const vectors = (await this.store.getItem<number[][]>('vectors')) || [];
        if (docId !== undefined) {
            vectors.push(embedding);
            await this.store.setItem('vectors', vectors);
            console.log(
                `Added embedding for document ${docId}, total vectors: ${vectors.length}`
            );
        }
    }

    async similaritySearch(
        queryEmbedding: number[],
        queryText: string,
        topK = 3
    ) {
        const vectors = (await this.store.getItem<number[][]>('vectors')) || [];
        const metadata =
            (await this.store.getItem<ChunkMetadata[]>('metadata')) || [];

        if (vectors.length === 0) return [];

        const queryTerms = new Set(queryText.toLowerCase().split(/\s+/));

        const similarities = vectors.map((vector, index) => {
            const chunk = metadata[index]?.chunk || '';

            const chunkTerms = new Set(chunk.toLowerCase().split(/\s+/));
            const termOverlap = [...queryTerms].filter((term) =>
                chunkTerms.has(term)
            ).length;

            const dotProduct = queryEmbedding.reduce(
                (sum, q, i) => sum + q * vector[i],
                0
            );
            const magnitude1 = Math.sqrt(
                queryEmbedding.reduce((sum, q) => sum + q * q, 0)
            );
            const magnitude2 = Math.sqrt(
                vector.reduce((sum, v) => sum + v * v, 0)
            );
            const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);

            const score = cosineSimilarity * (1 + 0.1 * termOverlap);

            return {
                index,
                score,
                chunk,
                metadata: metadata[index],
            };
        });

        return similarities.sort((a, b) => b.score - a.score).slice(0, topK);
    }

    cosineSimilarity(a: number[], b: number[]) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}