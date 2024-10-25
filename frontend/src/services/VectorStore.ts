import localforage from 'localforage';

export interface Document {
    text: string;
    metadata: Record<string, unknown>;
}

export interface ChunkMetadata extends Record<string, unknown> {
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
        this.chunkSize = 100; // smaller chunks for better relevance
        this.chunkOverlap = 20; // add overlap to maintain context
        this.store = localforage.createInstance({
            name: 'local-vector-store',
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
        // split into sections first (based on "Section" keyword)
        const sections = text.split(/Section \d+:/);
        const chunks: string[] = [];

        sections.forEach((section) => {
            if (!section.trim()) return;

            // split sections into sentences
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
        // console.log(`Added document ${docId} with ${chunks.length} chunks`);
        return docId;
    }

    async addEmbedding(embedding: Float64Array, docId: number) {
        const vectors =
            (await this.store.getItem<Float64Array[]>('vectors')) || [];
        if (docId !== undefined) {
            vectors.push(embedding);
            await this.store.setItem('vectors', vectors);
            console.log(
                `Added embedding for document ${docId}, total vectors: ${vectors.length}`
            );
        }
    }

    async similaritySearch(queryEmbedding: Float64Array, topK = 3) {
        const vectors =
            (await this.store.getItem<Float64Array[]>('vectors')) || [];
        const metadata =
            (await this.store.getItem<ChunkMetadata[]>('metadata')) || [];

        if (vectors.length === 0) return [];
        console.log(vectors);
        console.log(metadata);
        // compute similarities and sort
        const similarities = vectors
            .map((vector, index) => ({
                score: this.cosineSimilarity(queryEmbedding, vector),
                metadata: metadata[index],
            }))

            .sort((a, b) => b.score - a.score)
            // filter out low similarity scores
            .filter((item) => item.score > 0.1)
            // take top K results
            .slice(0, topK);

        return similarities.map(({ score, metadata }) => ({
            chunk: metadata.chunk,
            score: score,
        }));
    }

    cosineSimilarity(a: Float64Array, b: Float64Array) {
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
