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
};

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
                    transition={{ duration: 0.3 }}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                    <div
                        className={`max-w-[80%] rounded-lg p-4 ${
                            message.role === 'user'
                                ? 'bg-sky-500 text-white'
                                : message.role === 'context'
                                ? 'bg-gray-100 text-gray-700 text-sm'
                                : 'bg-gray-200 text-gray-800'
                        }`}
                    >
                        {message.role === 'context' && message.metadata && (
                            <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                                <span>
                                    {message.metadata.type === 'email' && '📧'}
                                    {message.metadata.type === 'calendar' && '📅'}
                                    {message.metadata.type === 'document' && '📄'}
                                    {message.metadata.type === 'note' && '📝'}
                                </span>
                                <span>{message.metadata.title}</span>
                                <span className="opacity-50">
                                    {Math.round(message.metadata.score * 100)}% match
                                </span>
                            </div>
                        )}
                        <p className="whitespace-pre-wrap">{message.content}</p>
                        {message.source === 'voice' && (
                            <span className="ml-2 text-xs opacity-50">🎤</span>
                        )}
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