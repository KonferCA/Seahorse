// @ts-nocheck

import localforage from 'localforage';

export interface Document {
    pageContent: string;
    metadata: Record<any, any>;
}

export interface ChunkMetadata extends Record<any, any> {
    chunk: string;
    docId: string;
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
            name: 'vector-store',
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
        console.log('Vector store initialized');
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

    async addDocument(pageContent: string, metadata = {}) {
        if (!this.initialized) await this.initialize();

        const chunks = this.chunkText(pageContent);
        const documents = await this.store.getItem<Document[]>('documents') || [];
        const existingMetadata = await this.store.getItem<ChunkMetadata[]>('metadata') || [];

        const docId = `doc_${documents.length}`;
        documents.push({ pageContent, metadata });

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

    async addEmbedding(embedding: number[], docId: string) {
        const vectors = await this.store.getItem('vectors') || [];
        vectors.push({
            docId,
            vector: embedding
        });
        await this.store.setItem('vectors', vectors);
        console.log(`Added embedding for document ${docId}, total vectors: ${vectors.length}`);
    }

    async similaritySearch(queryVector: number[], queryText: string, k = 3) {
        const vectors = await this.store.getItem('vectors') || [];
        const metadata = await this.store.getItem<ChunkMetadata[]>('metadata') || [];

        if (vectors.length === 0) return [];

        const queryTerms = new Set(queryText.toLowerCase().split(/\s+/));

        const similarities = vectors.map(({docId, vector}, index) => {
            const pageContent = metadata[index]?.chunk || '';
            const contentTerms = new Set(pageContent.toLowerCase().split(/\s+/));
            const termOverlap = [...queryTerms].filter((term) =>
                contentTerms.has(term)
            ).length;

            let score = this.cosineSimilarity(queryVector, vector);
            if (isNaN(score)) {
                console.warn('cosine similarity returned NaN, defaulting to 0');
                score = 0;
            }
            
            score = score * (1 + 0.1 * termOverlap);
            
            console.log(`Score for chunk ${index}: ${score}, termOverlap: ${termOverlap}`);
            return {
                pageContent,
                metadata: {
                    ...metadata[index],
                    score: Math.max(0, Math.min(1, score))
                },
                score: Math.max(0, Math.min(1, score))
            };
        });

        const validSimilarities = similarities.filter(s => !isNaN(s.score) && s.score > 0);
        return validSimilarities
            .sort((a, b) => b.score - a.score)
            .slice(0, k);
    }

    private cosineSimilarity(a: number[], b: number[]) {
        if (!a || !b || a.length !== b.length) {
            console.warn('invalid vectors for cosine similarity');
            return 0;
        }

        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < a.length; i++) {
            if (typeof a[i] !== 'number' || typeof b[i] !== 'number') {
                console.warn('non-numeric values in vectors');
                return 0;
            }
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        
        const denominator = Math.sqrt(normA) * Math.sqrt(normB);
        if (denominator === 0) {
            console.warn('zero denominator in cosine similarity');
            return 0;
        }
        
        return dotProduct / denominator;
    }
}