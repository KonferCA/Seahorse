import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';

export type Message = {
    role: 'user' | 'assistant' | 'context';
    content: string;
    timestamp: Date;
    source?: 'voice' | 'text';
    metadata?: {
        type: 'email' | 'calendar' | 'document' | 'note';
        score: number;
        title?: string;
    };
    isStreaming?: boolean;
}

type ChatProps = {
    messages: Message[];
    onSendMessage: (message: string) => void;
    isLoading?: boolean;
};

export function Chat({ messages, onSendMessage, isLoading }: ChatProps) {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // auto scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    return (
        <div className="flex flex-col space-y-4">
            {messages.map((message, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${message.role === 'user'
                        ? 'justify-end'
                        : message.role === 'context'
                            ? 'justify-center'
                            : 'justify-start'
                        }`}
                >
                    <div
                        className={`max-w-[80%] p-4 rounded-lg ${message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : message.role === 'context'
                                ? 'bg-gray-200 text-gray-600 border border-gray-300'
                                : 'bg-gray-100 text-gray-800'
                            }`}
                    >
                        {message.role === 'context' && message.metadata && (
                            <div className="flex items-center gap-2 mb-2 text-sm border-b border-gray-300 pb-2">
                                <span className="font-medium">
                                    {message.metadata.type === 'email' ? '📧'
                                        : message.metadata.type === 'calendar' ? '📅'
                                            : '📄'}
                                    {message.metadata.title}
                                </span>
                                <span className="text-gray-500">
                                    (Relevance: {(message.metadata.score * 100).toFixed(1)}%)
                                </span>
                            </div>
                        )}
                        <p className="text-sm whitespace-pre-wrap">
                            {message.content}
                            {message.isStreaming && (
                                <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-400 animate-pulse" />
                            )}
                        </p>
                        <span className="text-xs opacity-70 mt-2 block">
                            {new Date(message.timestamp).toLocaleTimeString()}
                        </span>
                    </div>
                </motion.div>
            ))}
            {isLoading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                >
                    <div className="bg-gray-200 text-gray-800 rounded-lg p-4">
                        <div className="flex space-x-2">
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-100" />
                            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce delay-200" />
                        </div>
                    </div>
                </motion.div>
            )}
            <div ref={messagesEndRef} />
        </div>
    );
}

export default Chat;