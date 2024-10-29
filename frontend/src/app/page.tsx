'use client';

import {
    CreateMLCEngine,
    InitProgressReport,
    MLCEngine,
    prebuiltAppConfig,
} from '@mlc-ai/web-llm';
import { pipeline, env, FeatureExtractionPipeline } from '@xenova/transformers';
import { useEffect, useRef, useState } from 'react';
// import GoogleAuth from './utils/GoogleAuth';
import { formatGoogleData } from '@/utils/formatGoogleData';
// import { useGoogleData } from './hooks/useGoogleData';
import NearAuthGate from '@/components/NearAuthGate';
import { essay } from '@/data/essay';
import RAGStatusPanel from '@/components/RAGStatusPanel';
import GoogleDataPanel from '@/components/GoogleDataPanel';
import Chat from '@/components/Chat';
import { VectorStore } from '@/services';
import type { Message } from '@/components/Chat';
import type { GroupProgress } from '@/components/RAGStatusPanel';

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

env.useBrowserCache = true;
env.allowLocalModels = false;

export default function Home() {
    const selectedModel = 'Phi-3.5-mini-instruct-q4f16_1-MLC-1k';
    // const selectedModel = 'Phi-3.5-vision-instruct-q4f16_1-MLC';
    const appConfig = prebuiltAppConfig;
    appConfig.useIndexedDBCache = true;

    const [prompt, setPrompt] = useState('');
    const [progress, setProgress] = useState<ProgressState>({
        progress: 0,
        text: '',
        timeElapsed: 0,
        stage: '',
        isInitializing: false,
    });
    const [response, setResponse] = useState('');
    const [googleData, setGoogleData] = useState({
        calendar: [],
        emails: [],
    });

    const [ragGroups, setRagGroups] = useState<GroupProgress[]>([]);

    const engineRef = useRef<MLCEngine>();
    const embeddingModelRef = useRef<FeatureExtractionPipeline>();
    const vectorStoreRef = useRef<VectorStore>(new VectorStore());
    const [ragItems, setRagItems] = useState<RAGItem[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);

    const initProgressCallback = (progressData: InitProgressReport) => {
        setProgress((prev) => {
            if (!progressData.progress && !progressData.text) {
                return {
                    ...prev,
                    progress: 5,
                    text: 'Initializing WebGPU environment...',
                    timeElapsed: 0,
                    stage: 'Setup',
                    isInitializing: true,
                };
            }

            let adjustedProgress = progressData.progress;
            let stage = 'Preparing...';

            if (progressData.text.includes('download')) {
                adjustedProgress = 10 + progressData.progress * 0.5;
                stage = 'Downloading Model';
            } else if (progressData.text.includes('initialize')) {
                adjustedProgress = 60 + progressData.progress * 0.3;
                stage = 'Initializing Model';
            } else if (progressData.text.includes('shader')) {
                adjustedProgress = 90 + progressData.progress * 0.1;
                stage = 'Compiling Shaders';
            }

            return {
                ...prev,
                progress: Math.round(adjustedProgress),
                text: progressData.text || prev.text,
                timeElapsed: progressData.timeElapsed || prev.timeElapsed,
                stage,
                isInitializing: true,
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
                isInitializing: false,
            });
        };
    }, []);

    const create = async () => {
        setProgress((prev) => ({
            ...prev,
            progress: 2,
            text: 'Preparing WebGPU environment...',
            stage: 'Setup',
            isInitializing: true,
        }));

        try {
            setProgress((prev) => ({
                ...prev,
                progress: 10,
                text: 'Initializing embedding pipeline...',
                stage: 'Setup',
                isInitializing: true,
            }));

            const embedModel = await pipeline(
                'feature-extraction',
                'Xenova/all-MiniLM-L6-v2'
            );

            setProgress((prev) => ({
                ...prev,
                progress: 30,
                text: 'Embedding model loaded, preparing main model...',
                stage: 'Setup',
                isInitializing: true,
            }));

            const engine = await CreateMLCEngine(selectedModel, {
                initProgressCallback: (progressData: any) => {
                    setProgress((prev) => {
                        let stage = 'Loading Model';
                        let adjustedProgress = 30;

                        if (progressData.text?.includes('download')) {
                            adjustedProgress = 30 + progressData.progress * 0.4;
                            stage = 'Downloading Model';
                        } else if (progressData.text?.includes('initialize')) {
                            adjustedProgress = 70 + progressData.progress * 0.2;
                            stage = 'Initializing Model';
                        } else if (progressData.text?.includes('shader')) {
                            adjustedProgress = 90 + progressData.progress * 0.1;
                            stage = 'Compiling Shaders';
                        } else if (
                            !progressData.text &&
                            !progressData.progress
                        ) {
                            adjustedProgress = prev.progress + 1;
                            stage = 'Processing';
                        }

                        return {
                            ...prev,
                            progress: Math.min(
                                Math.round(adjustedProgress),
                                99
                            ),
                            text: progressData.text || prev.text,
                            timeElapsed:
                                progressData.timeElapsed || prev.timeElapsed,
                            stage,
                            isInitializing: true,
                        };
                    });
                },
                appConfig,
            });

            embeddingModelRef.current = embedModel;
            engineRef.current = engine;

            setProgress((prev) => ({
                ...prev,
                progress: 100,
                text: 'Ready',
                stage: 'Complete',
                isInitializing: false,
            }));
        } catch (error) {
            console.error('Error initializing:', error);
            setProgress((prev) => ({
                ...prev,
                text: 'Error initializing model. Please refresh.',
                stage: 'Error',
                isInitializing: false,
            }));
        }
    };

    useEffect(() => {
        create();
    }, []);

    useEffect(() => {
        const processGoogleData = async () => {
            if (!embeddingModelRef.current || !googleData) return;

            if (
                googleData.calendar.length > 0 ||
                googleData.emails.length > 0
            ) {
                setRagGroups((prev: any) => {
                    const existingDocumentGroup = prev.find(
                        (g: any) => g.type === 'document'
                    );
                    const newGroups = [
                        {
                            type: 'email',
                            total: googleData.emails.length,
                            completed: 0,
                            error: 0,
                            inProgress: 0,
                        },
                        {
                            type: 'calendar',
                            total: googleData.calendar.length,
                            completed: 0,
                            error: 0,
                            inProgress: 0,
                        },
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
                    setRagGroups((prev) =>
                        prev.map((group) =>
                            group.type === item.type
                                ? { ...group, inProgress: group.inProgress + 1 }
                                : group
                        )
                    );

                    try {
                        const docId = await vectorStoreRef.current.addDocument(
                            item.content,
                            {
                                ...item.metadata,
                                filename: `${item.type}_${item.metadata[`${item.type}Id`]}.txt`,
                                type: 'text/plain',
                            }
                        );

                        const embedding = await embeddingModelRef.current(
                            item.content,
                            {
                                pooling: 'mean',
                                normalize: true,
                            }
                        );

                        await vectorStoreRef.current.addEmbedding(
                            Array.from(embedding.data),
                            docId
                        );

                        setRagGroups((prev) =>
                            prev.map((group) =>
                                group.type === item.type
                                    ? {
                                        ...group,
                                        completed: group.completed + 1,
                                        inProgress: group.inProgress - 1,
                                    }
                                    : group
                            )
                        );
                    } catch (error) {
                        setRagGroups((prev) =>
                            prev.map((group) =>
                                group.type === item.type
                                    ? {
                                        ...group,
                                        error: group.error + 1,
                                        inProgress: group.inProgress - 1,
                                    }
                                    : group
                            )
                        );
                        console.error(
                            `Error processing ${item.type} item:`,
                            error
                        );
                    }
                }
            }
        };

        processGoogleData();
    }, [googleData]);

    // useEffect(() => {
    // const loadDemoEssay = async () => {
    // if (!embeddingModelRef.current) return;
    //
    // setRagGroups((prev: any) => {
    //     const documentGroup = {
    //         type: 'document',
    //         total: 1,
    //         completed: 0,
    //         error: 0,
    //         inProgress: 1,
    //     };
    //     return [...prev, documentGroup];
    // });
    //
    // console.log('Loading essay content:', essay.slice(0, 100));
    //
    // const demoItem: RAGItem = {
    //     id: 'demo_essay_1',
    //     type: 'document',
    //     title: 'Demo Essay',
    //     status: 'pending',
    //     timestamp: Date.now(),
    // };
    //
    // setRagItems((prev) => [...prev, demoItem]);
    //
    // try {
    //     setRagItems((prev) =>
    //         prev.map((item) =>
    //             item.id === 'demo_essay_1'
    //                 ? { ...item, status: 'embedding' as const }
    //                 : item
    //         )
    //     );
    //
    //     const docId = await vectorStoreRef.current.addDocument(essay, {
    //         documentId: 'demo_essay_1',
    //         title: 'Demo Essay',
    //         filename: 'demo_essay.txt',
    //         type: 'text/plain',
    //     });
    //
    //     const embedding = await embeddingModelRef.current(essay, {
    //         pooling: 'mean',
    //         normalize: true,
    //     });
    //
    //     await vectorStoreRef.current.addEmbedding(
    //         Array.from(embedding.data),
    //         docId
    //     );
    //
    //     setRagItems((prev) =>
    //         prev.map((item) =>
    //             item.id === 'demo_essay_1'
    //                 ? { ...item, status: 'completed' as const }
    //                 : item
    //         )
    //     );
    //
    //     setRagGroups((prev) =>
    //         prev.map((group) =>
    //             group.type === 'document'
    //                 ? { ...group, completed: 1, inProgress: 0 }
    //                 : group
    //         )
    //     );
    // } catch (error) {
    //     setRagGroups((prev) =>
    //         prev.map((group) =>
    //             group.type === 'document'
    //                 ? { ...group, error: 1, inProgress: 0 }
    //                 : group
    //         )
    //     );
    //     console.error('Error loading demo essay:', error);
    // }
    // };
    // if (embeddingModelRef.current && progress.progress === 100) {
    //     loadDemoEssay();
    // }
    // }, [embeddingModelRef.current, progress.progress]);

    const query = async () => {
        if (!engineRef.current || !embeddingModelRef.current) return;

        setMessages((prev) => [
            ...prev,
            {
                role: 'user',
                content: prompt,
                timestamp: new Date(),
            },
        ]);

        const embeddings = await embeddingModelRef.current(prompt, {
            pooling: 'mean',
            normalize: true,
        });

        const results = await vectorStoreRef.current.similaritySearch(
            Array.from(embeddings.data),
            prompt,
            4
        );

        const contextMessages = results.map((r) => ({
            role: 'context' as const,
            content: r.chunk,
            timestamp: new Date(),
            metadata: {
                type: r.metadata.type,
                score: r.score,
                title: r.metadata.title || 'Untitled',
            },
        }));

        setMessages((prev) => [...prev, ...contextMessages]);

        let context = results.map((r) => r.chunk).join('\n');

        const reply = await engineRef.current.chat.completions.create({
            messages: [
                {
                    role: 'system',
                    content: `Here is some context that might help you answer the user's query: \n${context}\n\nYou are supportive friend. Do not hallucinate, be polite and concise.`,
                },
                { role: 'user', content: prompt },
            ],
        });

        setMessages((prev: any) => [
            ...prev,
            {
                role: 'assistant',
                content: reply.choices[0]?.message.content,
                timestamp: new Date(),
            },
        ]);

        setPrompt('');
    };

    const handleGoogleData = (calendar: any, emails: any) => {
        setGoogleData({
            calendar,
            emails,
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
                            <h2 className="text-xl font-semibold text-gray-800">
                                AI Assistant
                            </h2>
                        </div>

                        {}
                        <div className="h-[60vh] overflow-y-auto p-4">
                            <Chat
                                messages={messages}
                                onSendMessage={query}
                                isLoading={
                                    progress.progress > 0 &&
                                    progress.progress < 100
                                }
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
                                    disabled={
                                        !prompt.trim() ||
                                        (progress.progress > 0 &&
                                            progress.progress < 100)
                                    }
                                    className={`px-4 py-2 bg-sky-400 text-white rounded-lg font-medium
                                        ${progress.progress > 0 &&
                                            progress.progress < 100
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-sky-500 active:bg-sky-600'
                                        }`}
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
                                                transition:
                                                    'width 0.5s ease-in-out',
                                            }}
                                        />
                                    </div>
                                    <div className="mt-2 flex justify-between text-xs text-gray-500">
                                        <span>{progress.text}</span>
                                        <span>
                                            {progress.timeElapsed.toFixed(1)}s
                                        </span>
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
}
