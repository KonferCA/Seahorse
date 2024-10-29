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
        <div className="bg-white rounded-lg shadow-lg p-6">
            {groups.map((group) => {
                const progress = (group.completed / group.total) * 100;
                const hasErrors = group.error > 0;

                return (
                    <div key={group.type} className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <h3 className="text-lg font-semibold capitalize">
                                {typeEmojis[group.type]}{' '}
                                {group.type.charAt(0).toUpperCase() +
                                    group.type.slice(1)}
                                s
                            </h3>
                            <span className="text-sm text-gray-500">
                                {group.completed}/{group.total}
                            </span>
                        </div>

                        {/* progress bar */}
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className={`h-full transition-all duration-500 ${
                                    hasErrors ? 'bg-red-400' : 'bg-sky-400'
                                }`}
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        {/* stats */}
                        <div className="mt-2 flex gap-4 text-sm">
                            {hasErrors && (
                                <span className="text-red-500">
                                    ⚠️ Errors: {group.error}
                                </span>
                            )}
                            {group.inProgress > 0 && (
                                <span className="text-sky-500">
                                    🔄 Processing: {group.inProgress}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}

            {groups.length === 0 && (
                <div className="text-center text-gray-500 mt-8">
                    📭 No items in the RAG system yet
                </div>
            )}
        </div>
    );
}