import localforage from 'localforage';

const store = localforage.createInstance({
    name: 'vector-store',
    version: 1.0
});

export class VectorStore {
    constructor() {
        this.initialized = false;
        this.chunkSize = 100;  // smaller chunks for better relevance
        this.chunkOverlap = 20;  // add overlap to maintain context
    }

    async initialize() {
        if (this.initialized) return;
        await Promise.all([
            store.setItem('vectors', []),
            store.setItem('metadata', []),
            store.setItem('documents', [])
        ]);
        this.initialized = true;
        console.log('Vector store initialized');
    }

    chunkText(text) {
        // split into sections first (based on "Section" keyword)
        const sections = text.split(/Section \d+:/);
        const chunks = [];
        
        sections.forEach(section => {
            if (!section.trim()) return;
            
            // split sections into sentences
            const sentences = section.match(/[^.!?]+[.!?]+/g) || [section];
            let currentChunk = [];
            let currentLength = 0;
            
            sentences.forEach(sentence => {
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

    async addDocument(text, metadata = {}) {
        if (!this.initialized) await this.initialize();
        
        const chunks = this.chunkText(text);
        const documents = await store.getItem('documents') || [];
        const existingMetadata = await store.getItem('metadata') || [];

        const docId = documents.length;
        documents.push({ text, metadata });

        for (let i = 0; i < chunks.length; i++) {
            existingMetadata.push({
                chunk: chunks[i],
                docId,
                chunkIndex: i,
                ...metadata
            });
        }

        await store.setItem('documents', documents);
        await store.setItem('metadata', existingMetadata);
        console.log(`Added document ${docId} with ${chunks.length} chunks`);
        return docId;
    }

    async addEmbedding(embedding, docId) {
        const vectors = await store.getItem('vectors') || [];
        if (docId !== undefined) {
            vectors.push(embedding);
            await store.setItem('vectors', vectors);
            console.log(`Added embedding for document ${docId}, total vectors: ${vectors.length}`);
        }
    }

    async similaritySearch(queryEmbedding, topK = 3) {
        const vectors = await store.getItem('vectors') || [];
        const metadata = await store.getItem('metadata') || [];

        if (vectors.length === 0) return [];

        // compute similarities and sort
        const similarities = vectors.map((vector, index) => ({
            score: this.cosineSimilarity(queryEmbedding, vector),
            metadata: metadata[index]
        }))
        .sort((a, b) => b.score - a.score)
        // filter out low similarity scores
        .filter(item => item.score > 0.1)
        // take top K results
        .slice(0, topK);

        return similarities.map(({ score, metadata }) => ({
            chunk: metadata.chunk,
            score: score
        }));
    }

    cosineSimilarity(a, b) {
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
