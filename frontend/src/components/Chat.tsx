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

    // auto scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const chatMessages = messages.filter(message => message.role !== 'context');

    return (
        <div className="flex flex-col space-y-4">
            {chatMessages.map((message, index) => (
                <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`flex ${
                        message.role === 'user' 
                            ? 'justify-end' 
                            : 'justify-start'
                    }`}               
                >
                    <div
                        className={`max-w-[80%] p-4 rounded-lg prose prose-sm ${
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
                                p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                                h2: ({children}) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                                h3: ({children}) => <h3 className="text-md font-bold mb-2">{children}</h3>,
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>

                        {message.isStreaming && (
                            <span className="inline-block w-1.5 h-4 ml-0.5 bg-gray-400 animate-pulse" />
                        )}
                        
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