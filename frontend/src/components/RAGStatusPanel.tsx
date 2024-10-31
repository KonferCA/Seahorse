import { useState } from 'react';

export type GroupProgress = {
    type: 'email' | 'calendar' | 'document' | 'note';
    total: number;
    completed: number;
    error: number;
    inProgress: number;
};

const typeEmojis = {
    email: '📧',
    calendar: '📅',
    document: '📄',
    note: '📝'
};

type RAGStatusPanelProps = {
    groups: GroupProgress[];
};

export default function RAGStatusPanel({ groups }: RAGStatusPanelProps) {
    return (
        <div className="bg-[#0f2c24] rounded-lg p-6 border-2 border-[#22886c]/20">
            {groups.map((group) => {
                const progress = (group.completed / group.total) * 100;
                const hasErrors = group.error > 0;
                return (
                    <div key={group.type} className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-semibold capitalize text-white">
                                {typeEmojis[group.type]}{' '}
                                {group.type.charAt(0).toUpperCase() +
                                    group.type.slice(1)}s
                            </h3>
                            <span className="text-sm text-white/50">
                                {group.completed}/{group.total}
                            </span>
                        </div>
                        {/* progress bar */}
                        <div className="h-2 bg-[#071b16] rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${
                                    hasErrors ? 'bg-red-400' : 'bg-[#22886c]'
                                }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        {/* stats */}
                        <div className="mt-2 flex gap-4 text-sm">
                            {hasErrors && (
                                <span className="text-red-400">
                                    ⚠️ Errors: {group.error}
                                </span>
                            )}
                            {group.inProgress > 0 && (
                                <span className="text-[#22886c]">
                                    🔄 Processing: {group.inProgress}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
            {groups.length === 0 && (
                <div className="text-center text-white/50 mt-8">
                    📭 No items in the RAG system yet
                </div>
            )}
        </div>
    );
};