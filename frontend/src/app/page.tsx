'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
// import GoogleAuth from './utils/GoogleAuth';
import { formatGoogleData } from '@/utils/formatGoogleData';
// import { useGoogleData } from './hooks/useGoogleData';
import NearAuthGate from '@/components/NearAuthGate';
// import { essay } from '@/data/essay';
import RAGStatusPanel from '@/components/RAGStatusPanel';
import GoogleDataPanel from '@/components/GoogleDataPanel';
import Chat from '@/components/Chat';
import { VectorStore } from '@/services';
import type { Message } from '@/components/Chat';
import type { GroupProgress } from '@/components/RAGStatusPanel';
import NotesPanel from '@/components/NotesPanel';
import { useNotes } from '@/hooks/useNotes';
import { Agent } from '@/agents/Agent';
import VoiceModal from '@/components/VoiceModal';
import ContextPanel, { ContextItem } from '@/components/ContextPanel';
import AdminPanel from '@/components/AdminPanel';
import PayoutPanel from '@/components/PayoutPanel';
import { ProviderTracker } from '@/services/ProviderTracker';

type ProgressState = {
    progress: number;
    text: string;
    timeElapsed: number;
};

type RAGItem = {
    id: string;
    type: 'email' | 'calendar' | 'document' | 'note';
    title: string;
    status: 'pending' | 'embedding' | 'completed' | 'error';
    timestamp: number;
};

// add interface for search results
interface SearchResult {
    chunk: string;
    score: number;
    metadata: {
        type: string;
        title?: string;
        [key: string]: any;
    };
}

export default function Home() {
    // const selectedModel = 'Phi-3.5-mini-instruct-q4f16_1-MLC-1k';
    const selectedModel = 'Phi-3.5-vision-instruct-q4f16_1-MLC';
    const [prompt, setPrompt] = useState('');
    const [progress, setProgress] = useState<ProgressState>({
        progress: 0,
        text: 'Initializing...',
        timeElapsed: 0,
    });
    const [response, setResponse] = useState('');
    const [googleData, setGoogleData] = useState({
        calendar: [],
        emails: [],
    });

    const [ragGroups, setRagGroups] = useState<GroupProgress[]>([]);

    const [ragItems, setRagItems] = useState<RAGItem[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);

    const agentRef = useRef<Agent | null>(null);

    const { notes, saveNote, deleteNote } = useNotes({ 
        agent: agentRef.current,
        setRagGroups 
    });

    const [currentStreamingMessage, setCurrentStreamingMessage] = useState('');

    const messageContentRef = useRef('');

    const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

    const [contextItems, setContextItems] = useState<ContextItem[]>([]);

    const handleStream = useCallback((token: string) => {
        setCurrentStreamingMessage(prev => prev + token);
    }, []);

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            query();
        }
    }

    useEffect(() => {
        const create = async () => {
            if (agentRef.current === null) {
                setProgress({
                    progress: 0,
                    text: 'Preparing environment...',
                    timeElapsed: 0
                });

                try {
                    const agent = new Agent(selectedModel);
                    await agent.initialize((update) => {
                        setProgress(prev => ({
                            progress: update.progress * 100,
                            text: update.message,
                            timeElapsed: prev.timeElapsed
                        }));

                        // handle rag updates
                        if (update.ragUpdate) {
                            setRagGroups(prev => {
                                const existingGroup = prev.find(g => g.type === update.ragUpdate!.type);
                                
                                if (!existingGroup && update.ragUpdate?.total) {
                                    return [...prev, {
                                        type: update.ragUpdate.type,
                                        total: update.ragUpdate.total,
                                        completed: update.ragUpdate.completed || 0,
                                        error: update.ragUpdate.error || 0,
                                        inProgress: update.ragUpdate.inProgress || 0
                                    }];
                                } else if (existingGroup) {
                                    return prev.map(group => 
                                        group.type === update.ragUpdate!.type
                                            ? {
                                                ...group,
                                                ...(update.ragUpdate?.total !== undefined && { total: update.ragUpdate.total }),
                                                ...(update.ragUpdate?.completed !== undefined && { completed: update.ragUpdate.completed }),
                                                ...(update.ragUpdate?.error !== undefined && { error: update.ragUpdate.error }),
                                                ...(update.ragUpdate?.inProgress !== undefined && { inProgress: update.ragUpdate.inProgress })
                                            }
                                            : group
                                    );
                                }
                                return prev;
                            });
                        }
                    });
                    agentRef.current = agent;
                } catch (error) {
                    console.error('Error initializing:', error);
                    setProgress({
                        progress: 0,
                        text: 'Error initializing model. Please refresh.',
                        timeElapsed: 0
                    });
                }
            }
        };
        create();
    }, []);

    useEffect(() => {
        const processGoogleData = async () => {
            if (!agentRef.current || !googleData) return;

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

                console.log(formattedItems.map((item) => item.content));

                console.log('embedding gmail and calendar');
                await agentRef.current.embedTexts(
                    formattedItems.map((item) => item.content)
                );
                console.log('embedded gmail and calendar');

                for (const item of formattedItems) {
                    setRagGroups((prev) =>
                        prev.map((group) =>
                            group.type === item.type
                                ? { ...group, inProgress: group.inProgress + 1 }
                                : group
                        )
                    );

                    try {
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

    useEffect(() => {
        console.log('Context items:', contextItems);
    }, [contextItems]);

    const query = async () => {
        if (!prompt.trim() || !agentRef.current) return;
        
        const currentPrompt = prompt;
        setPrompt('');
        messageContentRef.current = '';
        
        try {
            setMessages(prev => [
                ...prev,
                { role: 'user', content: currentPrompt, timestamp: new Date() }
            ]);
            
            // get similar documents
            const results = await agentRef.current.searchSimilar(currentPrompt, 4);
            
            // track provider usage - only track highest score per provider per query
            const tracker = new ProviderTracker();
            const providerScores = new Map<string, number>();

            // first find highest score per provider
            for (const [doc, score] of results) {
                if (doc.metadata?.source === 'provider' && doc.metadata?.providerId) {
                    const currentHighest = providerScores.get(doc.metadata.providerId) || 0;
                    if (score > currentHighest) {
                        providerScores.set(doc.metadata.providerId, score);
                    }
                }
            }

            // then log only the highest scores
            for (const [providerId, score] of providerScores) {
                const normalizedScore = Math.min(Math.max(score, 0), 1);
                await tracker.logProviderUsage(providerId, normalizedScore);
            }
            
            // add context messages if any found
            if (results.length > 0) {
                const newContextItems = results.map(([doc, score]) => ({
                    id: Math.random().toString(36).substring(2, 9),
                    type: (doc.metadata.type || 'document') as 'email' | 'calendar' | 'document',
                    title: doc.metadata.title || 'Untitled',
                    content: doc.pageContent,
                    timestamp: new Date(),
                    metadata: {
                        score
                    }
                }));

                setContextItems(newContextItems);

                const contextMessages = results.map((docTuple) => {
                    const [doc, score] = docTuple;
                    return {
                        role: 'context' as const,
                        content: doc.pageContent,
                        timestamp: new Date(),
                        metadata: {
                            type: doc.metadata.type || 'document',
                            title: doc.metadata.title || 'Untitled',
                            score,
                        },
                    };
                });
                setMessages((prev) => [...prev, ...contextMessages]);
            } else {
                setContextItems([]);
            }

            // add empty assistant message for streaming
            setMessages(prev => [
                ...prev,
                { 
                    role: 'assistant', 
                    content: '', 
                    timestamp: new Date(),
                    isStreaming: true 
                }
            ]);
            
            // set up streaming callback
            agentRef.current.setStreamingCallback((token: string) => {
                messageContentRef.current += token;
                setMessages(prev => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage.role === 'assistant') {
                        lastMessage.content = messageContentRef.current;
                    }
                    return newMessages;
                });
            });
            
            // generate response
            const response = await agentRef.current.generateResponse(currentPrompt);
            
            // update final message and remove streaming state
            setMessages(prev => {
                const newMessages = [...prev];
                const lastMessage = newMessages[newMessages.length - 1];
                if (lastMessage.role === 'assistant') {
                    lastMessage.isStreaming = false;
                }
                return newMessages;
            });
            
            setPrompt('');
        } catch (error) {
            console.error('Error during chat:', error);
            setMessages(prev => [
                ...prev,
                {
                    role: 'assistant',
                    content: 'Sorry, there was an error processing your request.',
                    timestamp: new Date()
                }
            ]);
        }
    };

    const handleGoogleData = (calendar: any, emails: any) => {
        console.log(calendar, emails);
        setGoogleData({
            calendar,
            emails,
        });
    };

    const handleProgress = useCallback((update: { 
        message: string; 
        progress: number;
        ragUpdate?: {
            type: string;
            total?: number;
            completed?: number;
            error?: number;
            inProgress?: number;
        };
    }) => {
        setProgress(prev => ({
            progress: update.progress * 100,
            text: update.message,
            timeElapsed: prev.timeElapsed
        }));

        if (update.ragUpdate) {
            setRagGroups(prev => {
                const existingGroup = prev.find(g => g.type === update.ragUpdate!.type);
                
                if (!existingGroup && update.ragUpdate?.total) {
                    // add new group
                    return [...prev, {
                        type: update.ragUpdate.type as any,
                        total: update.ragUpdate.total,
                        completed: update.ragUpdate.completed || 0,
                        error: update.ragUpdate.error || 0,
                        inProgress: update.ragUpdate.inProgress || 0
                    }];
                } else if (existingGroup) {
                    // update existing group
                    return prev.map(group => 
                        group.type === update.ragUpdate!.type
                            ? {
                                ...group,
                                ...(update.ragUpdate?.total !== undefined && { total: update.ragUpdate.total }),
                                ...(update.ragUpdate?.completed !== undefined && { completed: update.ragUpdate.completed }),
                                ...(update.ragUpdate?.error !== undefined && { error: update.ragUpdate.error }),
                                ...(update.ragUpdate?.inProgress !== undefined && { inProgress: update.ragUpdate.inProgress })
                            }
                            : group
                    );
                }
                return prev;
            });
        }
    }, []);

    // Add timer effect
    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;

        const updateTimer = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = (timestamp - startTime) / 1000;

            if (progress.progress > 0 && progress.progress < 100) {
                setProgress(prev => ({
                    ...prev,
                    timeElapsed: elapsed
                }));
                animationFrameId = requestAnimationFrame(updateTimer);
            }
        };

        if (progress.progress > 0 && progress.progress < 100) {
            animationFrameId = requestAnimationFrame(updateTimer);
        }

        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [progress.progress]);

    return (
        <NearAuthGate>
            <main className="min-h-screen bg-gray-50">
                <div className="max-w-6xl mx-auto flex gap-4 p-4 h-[calc(100vh-2rem)]"> {/* Adjusted height and padding */}
                    <div className="flex-1 bg-white rounded-lg shadow-lg flex flex-col"> {/* Removed fixed height */}
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-800">
                                AI Assistant
                            </h2>
                        </div>

                        <div className="flex-1 flex flex-col overflow-hidden"> {/* This will take remaining height */}
                            <Chat
                                messages={messages}
                                onSendMessage={query}
                                isLoading={progress.progress > 0 && progress.progress < 100}
                            />
                        </div>

                        {progress.progress > 0 && progress.progress < 100 && (
                            <div className="px-4 py-2 border-t border-gray-100">
                                <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                                    <span>{progress.text}</span>
                                    <span>{progress.timeElapsed?.toFixed(1) || '0.0'}s</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-1">
                                    <div 
                                        className="bg-blue-500 h-1 rounded-full transition-all duration-300" 
                                        style={{ width: `${progress.progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="p-4 border-t border-gray-200">
                            <div className="flex gap-2">
                                <input
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    placeholder="Ask me anything..."
                                    className="flex-1 p-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-400"
                                />
                                <button
                                    onClick={() => setIsVoiceModalOpen(true)}
                                    className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg font-medium"
                                >
                                    🎤
                                </button>
                                <button
                                    onClick={query}
                                    disabled={!prompt.trim() || (progress.progress > 0 && progress.progress < 100)}
                                    className={`px-4 py-2 bg-sky-400 text-white rounded-lg font-medium
                                        ${progress.progress > 0 && progress.progress < 100
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-sky-500 active:bg-sky-600'
                                        }`}
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="w-80 space-y-4 overflow-y-auto max-h-[calc(100vh-2rem)]"> {/* Added max-height and overflow */}
                        <AdminPanel />
                        <GoogleDataPanel onDataReceived={handleGoogleData} />
                        <RAGStatusPanel groups={ragGroups} />
                        <PayoutPanel />
                        <NotesPanel 
                            notes={notes} 
                            onSave={saveNote}
                            onDelete={deleteNote}
                        />
                        <ContextPanel items={contextItems} />
                    </div>
                </div>
            </main>
        </NearAuthGate>
    );
}
