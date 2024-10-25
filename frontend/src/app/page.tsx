'use client';
import { CreateMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';
import { pipeline, env } from '@xenova/transformers';
import { useEffect, useRef, useState } from 'react';
import localforage from 'localforage';

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

    chunkText(text) {
        // split into sections first (based on "Section" keyword)
        const sections = text.split(/Section \d+:/);
        const chunks = [];

        sections.forEach((section) => {
            if (!section.trim()) return;

            // split sections into sentences
            const sentences = section.match(/[^.!?]+[.!?]+/g) || [section];
            let currentChunk = [];
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

    async addDocument(text, metadata = {}) {
        if (!this.initialized) await this.initialize();

        const chunks = this.chunkText(text);
        const documents = (await this.store.getItem('documents')) || [];
        const existingMetadata = (await this.store.getItem('metadata')) || [];

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

    async addEmbedding(embedding, docId) {
        const vectors = (await this.store.getItem('vectors')) || [];
        if (docId !== undefined) {
            vectors.push(embedding);
            await this.store.setItem('vectors', vectors);
            console.log(
                `Added embedding for document ${docId}, total vectors: ${vectors.length}`
            );
        }
    }

    async similaritySearch(queryEmbedding, topK = 3) {
        const vectors = (await this.store.getItem('vectors')) || [];
        const metadata = (await this.store.getItem('metadata')) || [];

        if (vectors.length === 0) return [];

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

env.useBrowserCache = true;
env.allowLocalModels = false;

export default function Home() {
    const [prompt, setPrompt] = useState('');
    const [progress, setProgress] = useState({
        progress: 0,
        text: '',
        timeElapsed: 0,
    });
    const [response, setResponse] = useState('');
    const engineRef = useRef();
    const embeddingModelRef = useRef();
    const vectorStoreRef = useRef<VectorStore>(new VectorStore());

    useEffect(() => {
        // Callback function to update model loading progress
        const initProgressCallback = (initProgress) => {
            setProgress(initProgress);
        };

        const selectedModel = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

        const appConfig = prebuiltAppConfig;
        appConfig.useIndexedDBCache = true;

        const create = async () => {
            const [embedModel, engine] = await Promise.all([
                await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2'),
                await CreateMLCEngine(
                    selectedModel,
                    { initProgressCallback: initProgressCallback, appConfig } // engineConfig
                ),
            ]);

            const embeddings = await embedModel(
                'my personal email is: personal_duck_duck@gmail.com',
                {
                    pooling: 'mean',
                    normalize: true,
                }
            );
            const docId = await vectorStoreRef.current.addDocument(
                'my personal email is: personal_duck_duck@gmail.com',
                {
                    filename: 'personal.txt',
                    type: 'text/plain',
                    size: 50,
                }
            );
            console.log('Added document:', docId);
            embeddingModelRef.current = embeddings;
            engineRef.current = engine;
        };

        create();
    }, []);

    const query = async () => {
        if (engineRef.current && embeddingModelRef.current) {
            // const reply = await engineRef.current.chat.completions.create({
            //     messages: [
            //         { role: 'system', content: 'You are supportive friend.' },
            //         { role: 'user', content: prompt },
            //     ],
            // });
            // setResponse(reply.choices[0]?.message.content);
        }
    };

    return (
        <div>
            <div className="flex flex-col text-white mb-4">
                <p>{response}</p>
            </div>
            <div className="flex flex-col gap-2">
                <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="text-black"
                />
                <button
                    onClick={query}
                    disabled={!engineRef.current}
                    className="padding-4 bg-sky-400"
                >
                    Click
                </button>
            </div>
            <div className="flex flex-col gap-2 text-white">
                <p>{progress.progress}</p>
                <p>{progress.timeElapsed}</p>
                <p>{progress.text}</p>
            </div>
        </div>
    );
}
