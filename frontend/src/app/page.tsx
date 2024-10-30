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
    const selectedModel = 'Phi-3.5-mini-instruct-q4f16_1-MLC-1k';
    // const selectedModel = 'Phi-3.5-vision-instruct-q4f16_1-MLC';
    const [prompt, setPrompt] = useState('');
    const [progress, setProgress] = useState<ProgressState>({
        progress: 0,
        text: '',
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
            setProgress((prev) => ({
                ...prev,
                progress: 0,
                text: 'Preparing environment...',
            }));

            try {
                if (agentRef.current === null) {
                    const agent = new Agent(selectedModel);
                    await agent.initialize((progress) =>
                        setProgress({
                            ...progress,
                        })
                    );
                    agentRef.current = agent;
                }
            } catch (error) {
                console.error('Error initializing:', error);
                setProgress((prev) => ({
                    ...prev,
                    text: 'Error initializing model. Please refresh.',
                }));
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

    const query = async () => {
        if (!prompt.trim() || !agentRef.current) return;
        
        const currentPrompt = prompt;
        setPrompt('');
        messageContentRef.current = ''; // reset message content before starting new chat
        
        try {
            // add user message
            setMessages(prev => [
                ...prev,
                { role: 'user', content: prompt, timestamp: new Date() }
            ]);
            
            // get similar documents
            const results = await agentRef.current.searchSimilar(prompt, 10);

            // add context messages if any found
            if (results.length > 0) {
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
            await agentRef.current.generateResponse(prompt);

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
                                    progress.progress < 1
                                }
                            />
                        </div>

                        {}
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
                                    disabled={
                                        !prompt.trim() ||
                                        (progress.progress > 0 &&
                                            progress.progress < 1)
                                    }
                                    className={`px-4 py-2 bg-sky-400 text-white rounded-lg font-medium
                                        ${progress.progress > 0 &&
                                            progress.progress < 1
                                            ? 'opacity-50 cursor-not-allowed'
                                            : 'hover:bg-sky-500 active:bg-sky-600'
                                        }`}
                                >
                                    Send
                                </button>
                            </div>

                            <VoiceModal
                                isOpen={isVoiceModalOpen}
                                onClose={() => setIsVoiceModalOpen(false)}
                                onSave={async (text) => {
                                    await saveNote(text);
                                    setIsVoiceModalOpen(false);
                                }}
                                onSend={(text) => {
                                    setPrompt(text);
                                    setIsVoiceModalOpen(false);
                                }}
                            />

                            {progress.progress >= 0 && (
                                <div className="mt-4 bg-white rounded-lg p-4 shadow-sm border border-gray-100">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-sm font-medium text-gray-700">
                                            {progress.text}
                                        </span>
                                        <span className="text-sm text-gray-500">
                                            {Math.floor(
                                                progress.progress * 100
                                            )}
                                            %
                                        </span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-sky-400 transition-all duration-300 ease-in-out"
                                            style={{
                                                width: `${Math.floor(progress.progress * 100)}%`,
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

                    <div className="w-80 space-y-4">
                        <GoogleDataPanel onDataReceived={handleGoogleData} />
                        <RAGStatusPanel groups={ragGroups} />
                        <NotesPanel 
                            notes={notes} 
                            onSave={saveNote}
                            onDelete={deleteNote}
                        />
                    </div>
                </div>
            </div>
        </NearAuthGate>
    );
}
