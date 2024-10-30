import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { HiOutlineCalendar, HiOutlineEnvelope, HiOutlineDocument, HiOutlineXMark } from "react-icons/hi2";

interface ContextItem {
    id: string;
    type: 'email' | 'calendar' | 'document';
    title: string;
    content: string;
    timestamp: Date;
    metadata?: {
        score: number;
    };
}

interface ContextPanelProps {
    items: ContextItem[];
}

export default function ContextPanel({ items }: ContextPanelProps) {
    const [selectedItem, setSelectedItem] = useState<ContextItem | null>(null);

    const parseDocumentContent = (item: ContextItem) => {
        const content = item.content;

        if (content.includes('Subject:') && content.includes('From:')) {
            const parsed = {
                subject: content.match(/Subject:\s*([^\n]+)/)?.[1]?.trim() || 'No Subject',
                from: content.match(/From:\s*([^\n]+)/)?.[1]?.trim() || '',
                date: content.match(/Date:\s*([^\n]+)/)?.[1]?.trim() || '',
                content: content.match(/Content:\s*([\s\S]+)$/)?.[1]?.trim() || ''
            };

            return {
                type: 'email' as const,
                title: parsed.subject,
                formattedContent: `**From:** ${parsed.from}

**Date:** ${parsed.date}

---

${parsed.content}`
            };
        }

        if (content.includes('Event:')) {
            const parsed = {
                title: content.match(/Event:\s*([^\n]+)/)?.[1]?.trim() || 'Untitled Event',
                date: content.match(/Date:\s*([^\n]+)/)?.[1]?.trim() || '',
                end: content.match(/End:\s*([^\n]+)/)?.[1]?.trim() || '',
                location: content.match(/Location:\s*([^\n]+)/)?.[1]?.trim() || '',
                attendees: content.match(/Attendees:\s*([^\n]+)/)?.[1]?.split(',').map(a => a.trim()) || []
            };

            return {
                type: 'calendar' as const,
                title: parsed.title,
                formattedContent: `**📅 Date & Time**
${parsed.date}${parsed.end ? ` - ${parsed.end}` : ''}

**📍 Location**
${parsed.location || 'No location specified'}

**👥 Attendees**
${parsed.attendees.map(a => `- ${a}`).join('\n')}`
            };
        }

        return {
            type: 'document' as const,
            title: 'Document',
            formattedContent: content
        };
    };

    const getDocumentIcon = (item: ContextItem) => {
        const parsed = parseDocumentContent(item);
        switch (parsed.type) {
            case 'calendar':
                return <HiOutlineCalendar className="w-4 h-4 text-green-600" />;
            case 'email':
                return <HiOutlineEnvelope className="w-4 h-4 text-blue-600" />;
            default:
                return <HiOutlineDocument className="w-4 h-4 text-gray-600" />;
        }
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>📎</span> Context
            </h2>
            
            <div className="space-y-2">
                {items.map(item => {
                    const parsed = parseDocumentContent(item);
                    return (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            onClick={() => setSelectedItem(item)}
                            className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-all hover:shadow-md"
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex gap-3">
                                    <div className="mt-1">
                                        {getDocumentIcon(item)}
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-sm leading-5">
                                            {parsed.title}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Relevance: {item.metadata?.score ? (item.metadata.score * 100).toFixed(1) : 0}%
                                        </p>
                                    </div>
                                </div>
                                <span className="text-xs text-gray-500 shrink-0 ml-4">
                                    {new Date(item.timestamp).toLocaleTimeString()}
                                </span>
                            </div>
                        </motion.div>
                    );
                })}
            </div>

            <AnimatePresence>
                {selectedItem && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    >
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-lg w-full max-w-2xl overflow-hidden shadow-xl"
                        >
                            <div className="p-6 border-b border-gray-200">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        {getDocumentIcon(selectedItem)}
                                        <h2 className="text-xl font-semibold">
                                            {parseDocumentContent(selectedItem).title}
                                        </h2>
                                    </div>
                                    <button 
                                        onClick={() => setSelectedItem(null)}
                                        className="text-gray-500 hover:text-gray-700"
                                    >
                                        <HiOutlineXMark className="w-6 h-6" />
                                    </button>
                                </div>
                            </div>

                            <div className="p-6 prose prose-sm max-w-none">
                                <ReactMarkdown>
                                    {parseDocumentContent(selectedItem).formattedContent}
                                </ReactMarkdown>
                            </div>

                            <div className="p-6 border-t border-gray-200 flex justify-end">
                                <button
                                    onClick={() => setSelectedItem(null)}
                                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};