import localforage from 'localforage';

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

    async addDocument(text: string, metadata: any) {
        if (!this.initialized) await this.initialize();
        
        const documents = await this.store.getItem('documents') || [];
        const docId = `doc_${documents.length}`;
        
        documents.push({
            id: docId,
            text,
            metadata
        });
        
        await this.store.setItem('documents', documents);
        return docId;
    }

    async addEmbedding(embedding: number[], docId: string) {
        const vectors = await this.store.getItem('vectors') || [];
        vectors.push({
            docId,
            vector: embedding
        });
        await this.store.setItem('vectors', vectors);
    }

    async similaritySearch(queryVector: number[], queryText: string, k = 3) {
        const vectors = await this.store.getItem('vectors') || [];
        const documents = await this.store.getItem('documents') || [];
        
        const scores = vectors.map(({docId, vector}) => ({
            docId,
            score: this.cosineSimilarity(queryVector, vector)
        }));
        
        scores.sort((a, b) => b.score - a.score);
        
        const topK = scores.slice(0, k);
        
        return topK.map(({docId, score}) => {
            const doc = documents.find(d => d.id === docId);
            return {
                chunk: doc.text,
                metadata: doc.metadata,
                score
            };
        });
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