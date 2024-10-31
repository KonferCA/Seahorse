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
import type { Note } from '@/components/NotesPanel';

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
    pageContent: string;
    metadata: {
        score: number;
        type: string;
        title?: string;
        source?: string;
        providerId?: string;
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

    const { notes, saveNote: saveNoteContent, deleteNote } = useNotes({ 
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
            for (const result of results) {
                // handle result as [document, score] tuple
                const [doc, similarity] = result;
                const score = similarity || doc.metadata?.score || 0;
                
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
                const newContextItems = results.map(([doc]) => ({
                    id: Math.random().toString(36).substring(2, 9),
                    type: (doc.metadata?.type || 'document') as 'email' | 'calendar' | 'document',
                    title: doc.metadata?.title || 'Untitled',
                    content: doc.pageContent,
                    timestamp: new Date(),
                    metadata: {
                        score: doc.metadata?.score || 0
                    }
                }));

                setContextItems(newContextItems);

                const contextMessages = results.map(([doc]) => ({
                    role: 'context' as const,
                    content: doc.pageContent,
                    timestamp: new Date(),
                    metadata: {
                        type: doc.metadata?.type || 'document',
                        title: doc.metadata?.title || 'Untitled',
                        score: doc.metadata?.score || 0,
                    },
                }));
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

    // Create a wrapper function that matches the NotesPanel props type
    const handleSaveNote = (note: Note) => {
        return saveNoteContent(note.content);
    };

    return (
        <NearAuthGate>
            <main className="min-h-screen relative">
                <div className="fixed inset-0 bg-[#071b16]">
                    <div className="absolute bottom-0 left-0 right-0 top-0 bg-[linear-gradient(to_right,#4f4f4f2e_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f2e_1px,transparent_1px)] bg-[size:14px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>
                </div>

                <div className="relative max-w-6xl mx-auto flex gap-4 p-4 h-[calc(100vh-2rem)]">
                    <div className="flex-1 bg-white/10 backdrop-blur-sm rounded-lg shadow-lg flex flex-col border border-white/10">
                        <div className="p-4 border-b border-white/10">
                            <h2 className="text-xl font-semibold text-white/90">
                                welcome to seahorse.
                            </h2>
                        </div>

                        <div className="flex-1 flex flex-col overflow-hidden">
                            <Chat
                                messages={messages}
                                onSendMessage={query}
                                isLoading={progress.progress > 0 && progress.progress < 100}
                            />
                        </div>

                        {progress.progress > 0 && progress.progress < 100 && (
                            <div className="px-4 py-2 border-t border-white/10">
                                <div className="flex items-center justify-between text-xs text-white/70 mb-1">
                                    <span>{progress.text}</span>
                                    <span>{progress.timeElapsed?.toFixed(1) || '0.0'}s</span>
                                </div>
                                <div className="w-full bg-white/5 rounded-full h-1">
                                    <div 
                                        className="bg-sky-400 h-1 rounded-full transition-all duration-300" 
                                        style={{ width: `${progress.progress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="p-4 border-t border-white/10">
                            <div className="flex gap-2">
                                <input
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={handleKeyPress}
                                    placeholder="Ask me anything..."
                                    className="flex-1 p-2 border border-[#22886c]/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#22886c] bg-white/5 text-white placeholder-white/50 transition-colors"
                                />
                                <button
                                    onClick={() => setIsVoiceModalOpen(true)}
                                    className="px-4 py-2 bg-[#22886c]/10 hover:bg-[#22886c]/20 text-white/90 rounded-lg font-medium border border-[#22886c]/20 transition-colors"
                                >
                                    🎤
                                </button>
                                <button
                                    onClick={query}
                                    disabled={!prompt.trim() || (progress.progress > 0 && progress.progress < 100)}
                                    className={`px-4 py-2 bg-[#22886c] text-white rounded-lg font-medium transition-all duration-300
                                        ${progress.progress > 0 && progress.progress < 100
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-[#1b6d56] hover:scale-105'
                                        }`}
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="w-80 space-y-2 overflow-y-auto max-h-[calc(100vh-2rem)]">
                        <AdminPanel />
                        <GoogleDataPanel onDataReceived={handleGoogleData} />
                        <RAGStatusPanel groups={ragGroups} />
                        <PayoutPanel />
                        <NotesPanel 
                            notes={notes} 
                            onSave={handleSaveNote}
                            onDelete={deleteNote}
                        />
                        <ContextPanel items={contextItems} />
                    </div>
                </div>
            </main>
        </NearAuthGate>
    );
}
