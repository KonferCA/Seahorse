import localforage from 'localforage';

export interface Document {
    text: string;
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

    async addDocuments(documents: Document[]) {
        if (!this.initialized) await this.initialize();
        
        for (const doc of documents) {
            const chunks = this.chunkText(doc.text);
            const docId = `doc_${Math.random().toString(36).substr(2, 9)}`;
            
            // store document metadata
            const metadata = await this.store.getItem<ChunkMetadata[]>('metadata') || [];
            
            // embed each chunk
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                // get embedding for chunk
                const embedding = await this.embeddings.embedQuery(chunk);
                
                // store embedding
                await this.addEmbedding(embedding, docId);
                
                // store metadata
                metadata.push({
                    chunk,
                    docId,
                    chunkIndex: i,
                    ...doc.metadata  // preserve original document metadata
                });
            }
            
            await this.store.setItem('metadata', metadata);
        }
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
            const chunk = metadata[index]?.chunk || '';

            const chunkTerms = new Set(chunk.toLowerCase().split(/\s+/));
            const termOverlap = [...queryTerms].filter((term) =>
                chunkTerms.has(term)
            ).length;

            const score = this.cosineSimilarity(queryVector, vector) * (1 + 0.1 * termOverlap);
            console.log(`Score for chunk ${index}: ${score}`);
            return {
                chunk,
                metadata: {
                    ...metadata[index],
                    score: score
                },
                score
            };
        });

        return similarities.sort((a, b) => b.score - a.score).slice(0, k);
    }

    private cosineSimilarity(a: number[], b: number[]) {
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