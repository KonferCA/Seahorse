'use client';
import { CreateMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';
import { pipeline, env, FeatureExtractionPipeline } from '@xenova/transformers';
import { useEffect, useRef, useState } from 'react';
import localforage from 'localforage';
import GoogleAuth from './utils/GoogleAuth';
import { formatGoogleData } from './utils/formatGoogleData';
import { useGoogleData } from './hooks/useGoogleData';
import NearAuthGate from './components/NearAuthGate';
import { essay } from './data/essay';
import RAGStatusPanel from './components/RAGStatusPanel';
import GoogleDataPanel from './components/GoogleDataPanel';
import Chat from './components/Chat';

type ProgressState = {
    progress: number;
    text: string;
    timeElapsed: number;
    stage: string;
    isInitializing: boolean;
};

type RAGItem = {
    id: string;
    type: 'email' | 'calendar' | 'document';
    title: string;
    status: 'pending' | 'embedding' | 'completed' | 'error';
    timestamp: number;
};

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

    chunkText(text) {

        const sections = text.split(/Section \d+:/);
        const chunks = [];

        sections.forEach((section) => {
            if (!section.trim()) return;

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

    async similaritySearch(queryEmbedding: number[], queryText: string, topK = 3) {
        const vectors = (await this.store.getItem('vectors')) || [];
        const metadata = (await this.store.getItem('metadata')) || [];

        if (vectors.length === 0) return [];

        const queryTerms = new Set(queryText.toLowerCase().split(/\s+/));

        const similarities = vectors.map((vector, index) => {

            const chunk = metadata[index]?.chunk || '';

            const chunkTerms = new Set(chunk.toLowerCase().split(/\s+/));
            const termOverlap = [...queryTerms].filter(term => chunkTerms.has(term)).length;

            const dotProduct = queryEmbedding.reduce((sum, q, i) => sum + q * vector[i], 0);
            const magnitude1 = Math.sqrt(queryEmbedding.reduce((sum, q) => sum + q * q, 0));
            const magnitude2 = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
            const cosineSimilarity = dotProduct / (magnitude1 * magnitude2);

            const score = cosineSimilarity * (1 + 0.1 * termOverlap);

            return {
                index,
                score,
                chunk,
                metadata: metadata[index]
            };
        });

        return similarities
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
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
    const selectedModel = 'TinyLlama-1.1B-Chat-v1.0-q4f16_1-MLC-1k';
    const appConfig = prebuiltAppConfig;
    appConfig.useIndexedDBCache = true;

    const [prompt, setPrompt] = useState('');
    const [progress, setProgress] = useState<ProgressState>({
        progress: 0,
        text: '',
        timeElapsed: 0,
        stage: '',
        isInitializing: false
    });
    const [response, setResponse] = useState('');
    const [googleData, setGoogleData] = useState({
        calendar: [],
        emails: []
    });

    const [ragGroups, setRagGroups] = useState<GroupProgress[]>([]);

    const engineRef = useRef();
    const embeddingModelRef = useRef<FeatureExtractionPipeline>();
    const vectorStoreRef = useRef<VectorStore>(new VectorStore());
    const [ragItems, setRagItems] = useState<RAGItem[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);

    const initProgressCallback = (progressData: any) => {
        setProgress(prev => {

            if (!progressData.progress && !progressData.text) {
                return {
                    ...prev,
                    progress: 5,
                    text: 'Initializing WebGPU environment...',
                    timeElapsed: 0,
                    stage: 'Setup',
                    isInitializing: true
                };
            }

            let adjustedProgress = progressData.progress;
            let stage = 'Preparing...';

            if (progressData.text.includes('download')) {

                adjustedProgress = 10 + (progressData.progress * 0.5);
                stage = 'Downloading Model';
            } else if (progressData.text.includes('initialize')) {

                adjustedProgress = 60 + (progressData.progress * 0.3);
                stage = 'Initializing Model';
            } else if (progressData.text.includes('shader')) {

                adjustedProgress = 90 + (progressData.progress * 0.1);
                stage = 'Compiling Shaders';
            }

            return {
                ...prev,
                progress: Math.round(adjustedProgress),
                text: progressData.text || prev.text,
                timeElapsed: progressData.timeElapsed || prev.timeElapsed,
                stage,
                isInitializing: true
            };
        });
    };

    useEffect(() => {
        return () => {
            setProgress({
                progress: 0,
                text: '',
                timeElapsed: 0,
                stage: '',
                isInitializing: false
            });
        };
    }, []);

    const create = async () => {

        setProgress(prev => ({
            ...prev,
            progress: 2,
            text: 'Preparing WebGPU environment...',
            stage: 'Setup',
            isInitializing: true
        }));

        try {

            setProgress(prev => ({
                ...prev,
                progress: 10,
                text: 'Initializing embedding pipeline...',
                stage: 'Setup',
                isInitializing: true
            }));

            const embedModel = await pipeline(
                'feature-extraction',
                'Xenova/all-MiniLM-L6-v2'
            );

            setProgress(prev => ({
                ...prev,
                progress: 30,
                text: 'Embedding model loaded, preparing main model...',
                stage: 'Setup',
                isInitializing: true
            }));

            const engine = await CreateMLCEngine(
                selectedModel,
                { 
                    initProgressCallback: (progressData: any) => {

                        setProgress(prev => {
                            let stage = 'Loading Model';
                            let adjustedProgress = 30; 

                            if (progressData.text?.includes('download')) {
                                adjustedProgress = 30 + (progressData.progress * 0.4); 
                                stage = 'Downloading Model';
                            } else if (progressData.text?.includes('initialize')) {
                                adjustedProgress = 70 + (progressData.progress * 0.2); 
                                stage = 'Initializing Model';
                            } else if (progressData.text?.includes('shader')) {
                                adjustedProgress = 90 + (progressData.progress * 0.1); 
                                stage = 'Compiling Shaders';
                            } else if (!progressData.text && !progressData.progress) {

                                adjustedProgress = prev.progress + 1;
                                stage = 'Processing';
                            }

                            return {
                                ...prev,
                                progress: Math.min(Math.round(adjustedProgress), 99),
                                text: progressData.text || prev.text,
                                timeElapsed: progressData.timeElapsed || prev.timeElapsed,
                                stage,
                                isInitializing: true
                            };
                        });
                    },
                    appConfig 
                }
            );

            embeddingModelRef.current = embedModel;
            engineRef.current = engine;

            setProgress(prev => ({
                ...prev,
                progress: 100,
                text: 'Ready',
                stage: 'Complete',
                isInitializing: false
            }));
        } catch (error) {
            console.error('Error initializing:', error);
            setProgress(prev => ({
                ...prev,
                text: 'Error initializing model. Please refresh.',
                stage: 'Error',
                isInitializing: false
            }));
        }
    };

    useEffect(() => {
        create();
    }, []); 

    useEffect(() => {
        const processGoogleData = async () => {
            if (!embeddingModelRef.current || !googleData) return;

            if (googleData.calendar.length > 0 || googleData.emails.length > 0) {

                setRagGroups(prev => {
                    const existingDocumentGroup = prev.find(g => g.type === 'document');
                    const newGroups = [
                        {
                            type: 'email',
                            total: googleData.emails.length,
                            completed: 0,
                            error: 0,
                            inProgress: 0
                        },
                        {
                            type: 'calendar',
                            total: googleData.calendar.length,
                            completed: 0,
                            error: 0,
                            inProgress: 0
                        }
                    ];

                    return existingDocumentGroup 
                        ? [...newGroups, existingDocumentGroup]
                        : newGroups;
                });

                const formattedItems = formatGoogleData(
                    googleData.calendar, 
                    googleData.emails
                );

                for (const item of formattedItems) {

                    setRagGroups(prev => prev.map(group => 
                        group.type === item.type 
                            ? { ...group, inProgress: group.inProgress + 1 }
                            : group
                    ));

                    try {
                        const docId = await vectorStoreRef.current.addDocument(
                            item.content,
                            {
                                ...item.metadata,
                                filename: `${item.type}_${item.metadata[`${item.type}Id`]}.txt`,
                                type: 'text/plain',
                            }
                        );

                        const embedding = await embeddingModelRef.current(item.content, {
                            pooling: 'mean',
                            normalize: true,
                        });

                        await vectorStoreRef.current.addEmbedding(
                            Array.from(embedding.data),
                            docId
                        );

                        setRagGroups(prev => prev.map(group => 
                            group.type === item.type 
                                ? { 
                                    ...group, 
                                    completed: group.completed + 1,
                                    inProgress: group.inProgress - 1
                                }
                                : group
                        ));
                    } catch (error) {

                        setRagGroups(prev => prev.map(group => 
                            group.type === item.type 
                                ? { 
                                    ...group, 
                                    error: group.error + 1,
                                    inProgress: group.inProgress - 1
                                }
                                : group
                        ));
                        console.error(`Error processing ${item.type} item:`, error);
                    }
                }
            }
        };

        processGoogleData();
    }, [googleData]);

    useEffect(() => {
        const loadDemoEssay = async () => {
            if (!embeddingModelRef.current) return;

            setRagGroups(prev => {
                const documentGroup = {
                    type: 'document',
                    total: 1,
                    completed: 0,
                    error: 0,
                    inProgress: 1
                };
                return [...prev, documentGroup];
            });

            console.log('Loading essay content:', essay.slice(0, 100)); 

            const demoItem: RAGItem = {
                id: 'demo_essay_1',
                type: 'document',
                title: 'Demo Essay',
                status: 'pending',
                timestamp: Date.now()
            };

            setRagItems(prev => [...prev, demoItem]);

            try {

                setRagItems(prev => 
                    prev.map(item => 
                        item.id === 'demo_essay_1' 
                            ? { ...item, status: 'embedding' as const }
                            : item
                    )
                );

                const docId = await vectorStoreRef.current.addDocument(
                    essay,
                    {
                        type: 'document',
                        documentId: 'demo_essay_1',
                        title: 'Demo Essay',
                        filename: 'demo_essay.txt',
                        type: 'text/plain',
                    }
                );

                const embedding = await embeddingModelRef.current(essay, {
                    pooling: 'mean',
                    normalize: true,
                });

                await vectorStoreRef.current.addEmbedding(
                    Array.from(embedding.data),
                    docId
                );

                setRagItems(prev => 
                    prev.map(item => 
                        item.id === 'demo_essay_1' 
                            ? { ...item, status: 'completed' as const }
                            : item
                    )
                );

                setRagGroups(prev => prev.map(group => 
                    group.type === 'document' 
                        ? { ...group, completed: 1, inProgress: 0 }
                        : group
                ));

            } catch (error) {

                setRagGroups(prev => prev.map(group => 
                    group.type === 'document' 
                        ? { ...group, error: 1, inProgress: 0 }
                        : group
                ));
                console.error('Error loading demo essay:', error);
            }
        };

        if (embeddingModelRef.current && progress.progress === 100) {
            loadDemoEssay();
        }
    }, [embeddingModelRef.current, progress.progress]); 

    const query = async () => {
        if (!engineRef.current || !embeddingModelRef.current) return;

        setMessages(prev => [...prev, {
            role: 'user',
            content: prompt,
            timestamp: new Date()
        }]);

        const embeddings = await embeddingModelRef.current(prompt, {
            pooling: 'mean',
            normalize: true,
        });

        const results = await vectorStoreRef.current.similaritySearch(
            Array.from(embeddings.data),
            prompt,
            4
        );

        const contextMessages = results.map(r => ({
            role: 'context' as const,
            content: r.chunk,
            timestamp: new Date(),
            metadata: {
                type: r.metadata.type,
                score: r.score,
                title: r.metadata.title || 'Untitled'
            }
        }));

        setMessages(prev => [...prev, ...contextMessages]);

        let context = results.map(r => r.chunk).join('\n');

        const reply = await engineRef.current.chat.completions.create({
            messages: [
                { 
                    role: 'system', 
                    content: `Here is some context that might help you answer the user's query: \n${context}\n\nYou are supportive friend. Do not hallucinate, be polite and concise.`
                },
                { role: 'user', content: prompt },
            ],
        });

        setMessages(prev => [...prev, {
            role: 'assistant',
            content: reply.choices[0]?.message.content,
            timestamp: new Date()
        }]);

        setPrompt('');
    };

    const handleGoogleData = (calendar, emails) => {
        setGoogleData({
            calendar,
            emails
        });
    };

    return (
        <NearAuthGate>
            <div className="min-h-screen p-4 bg-gray-50">
                <div className="max-w-6xl mx-auto flex gap-4">
                    {}
                    <div className="flex-1 bg-white rounded-lg shadow-lg">
                        {}
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-800">AI Assistant</h2>
                        </div>

                        {}
                        <div className="h-[60vh] overflow-y-auto p-4">
                            <Chat 
                                messages={messages} 
                                onSendMessage={query}
                                isLoading={progress.progress > 0 && progress.progress < 100}
                            />
                        </div>

                        {}
                        <div className="p-4 border-t border-gray-200">
                            <div className="flex gap-2">
                                <input
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    placeholder="Ask me anything..."
                                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400"
                                />
                                <button
                                    onClick={query}
                                    disabled={!prompt.trim() || (progress.progress > 0 && progress.progress < 100)}
                                    className={`px-4 py-2 bg-sky-400 text-white rounded-lg font-medium
                                        ${(progress.progress > 0 && progress.progress < 100) 
                                            ? 'opacity-50 cursor-not-allowed' 
                                            : 'hover:bg-sky-500 active:bg-sky-600'}`}
                                >
                                    Send
                                </button>
                            </div>

                            {}
                            {progress.progress > 0 && (
                                <div className="mt-4 bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">
                                            {progress.stage || 'Loading...'}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {progress.progress}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-sky-400 transition-all duration-300 ease-in-out"
                                            style={{ 
                                                width: `${progress.progress}%`,
                                                transition: 'width 0.5s ease-in-out'
                                            }}
                                        />
                                    </div>
                                    <div className="mt-2 flex justify-between text-xs text-gray-500">
                                        <span>{progress.text}</span>
                                        <span>{progress.timeElapsed.toFixed(1)}s</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {}
                    <div className="w-80 space-y-4">
                        <GoogleDataPanel onDataReceived={handleGoogleData} />
                        <RAGStatusPanel groups={ragGroups} />
                    </div>
                </div>
            </div>
        </NearAuthGate>
    );
};