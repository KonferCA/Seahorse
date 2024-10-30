import { motion } from 'framer-motion';
import { useEffect, useRef } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import ReactMarkdown from 'react-markdown';

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

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const chatMessages = messages.filter(message => message.role !== 'context');

    return (
        <div className="flex flex-col flex-1">
            <div className="flex-1 overflow-y-auto p-4 space-y-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {chatMessages.map((message, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex w-full ${
                            message.role === 'user' 
                                ? 'justify-end' 
                                : 'justify-start'
                        }`}               
                    >
                        <div
                            className={`max-w-[80%] w-fit p-4 rounded-lg prose prose-sm overflow-hidden ${
                                message.role === 'user'
                                    ? 'bg-blue-500 text-white prose-invert'
                                    : 'bg-gray-100 text-gray-800'
                            }`}
                        >
                            <ReactMarkdown
                                components={{
                                    code({node, inline, className, children, ...props}) {
                                        const match = /language-(\w+)/.exec(className || '');
                                        return !inline && match ? (
                                            <SyntaxHighlighter
                                                style={oneDark}
                                                language={match[1]}
                                                PreTag="div"
                                                className="max-w-full overflow-x-auto"
                                                {...props}
                                            >
                                                {String(children).replace(/\n$/, '')}
                                            </SyntaxHighlighter>
                                        ) : (
                                            <code className={className} {...props}>
                                                {children}
                                            </code>
                                        );
                                    },
                                    p: ({children}) => <p className="mb-2 last:mb-0 break-words">{children}</p>,
                                }}
                            >
                                {message.content}
                            </ReactMarkdown>
                        </div>
                    </motion.div>
                ))}
                <div ref={messagesEndRef} />
            </div>
        </div>
    );
}

export default Chat;