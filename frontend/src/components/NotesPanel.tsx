import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Note {
    id: string;
    title: string;
    content: string;
    timestamp: number;
    ragData?: {
        docId: number;
        embedding: number[];
    };
}

interface NotesPanelProps {
    notes: Note[];
    onSave: (note: Note) => void;
    onDelete: (noteId: string) => void;
}

export default function NotesPanel({ notes, onSave, onDelete }: NotesPanelProps) {
    const [selectedNote, setSelectedNote] = useState<Note | null>(null);
    const [editedContent, setEditedContent] = useState('');
    const [editedTitle, setEditedTitle] = useState('');

    const handleNoteClick = (note: Note) => {
        setSelectedNote(note);
        setEditedContent(note.content);
        setEditedTitle(note.title);
    };

    const handleSave = () => {
        if (selectedNote) {
            onSave({
                ...selectedNote,
                title: editedTitle,
                content: editedContent,
                timestamp: Date.now()
            });
            setSelectedNote(null);
        }
    };

    return (
        <div className="bg-[#0f2c24] rounded-lg p-6 mt-4 border-2 border-[#22886c]/20">
            <h2 className="text-lg font-semibold mb-4 text-white">📝 Notes</h2>
            
            <div className="space-y-2">
                {notes.map(note => (
                    <div 
                        key={note.id}
                        onClick={() => handleNoteClick(note)}
                        className="p-3 border border-[#22886c]/20 rounded-lg bg-[#071b16] cursor-pointer"
                    >
                        <div className="flex justify-between items-center">
                            <h3 className="font-medium text-white">{note.title}</h3>
                            <span className="text-xs text-white/50">
                                {new Date(note.timestamp).toLocaleDateString()}
                            </span>
                        </div>
                    </div>
                ))}
            </div>

            <AnimatePresence>
                {selectedNote && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                    >
                        <motion.div
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="bg-[#0f2c24] rounded-lg p-6 w-full max-w-2xl border-2 border-[#22886c]/20"
                        >
                            <div className="flex justify-between items-center mb-4">
                                <input
                                    value={editedTitle}
                                    onChange={(e) => setEditedTitle(e.target.value)}
                                    className="text-xl font-semibold bg-transparent border-b border-transparent hover:border-[#22886c]/50 focus:border-[#22886c] focus:outline-none px-1 text-white placeholder-white/50"
                                />
                                <button 
                                    onClick={() => setSelectedNote(null)}
                                    className="text-white/50 hover:text-white"
                                >
                                    ×
                                </button>
                            </div>

                            <textarea
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                className="w-full h-64 p-3 border border-[#22886c]/20 rounded-lg mb-4 focus:ring-2 focus:ring-[#22886c] bg-[#071b16] text-white placeholder-white/50"
                            />

                            <div className="flex justify-between gap-2">
                                <button
                                    onClick={() => {
                                        if (selectedNote) {
                                            onDelete(selectedNote.id);
                                            setSelectedNote(null);
                                        }
                                    }}
                                    className="px-4 py-2 text-red-400 border-2 border-red-400/20 rounded-lg bg-[#071b16]"
                                >
                                    Delete Note
                                </button>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setSelectedNote(null)}
                                        className="px-4 py-2 text-white/70 border-2 border-[#22886c]/20 rounded-lg bg-[#071b16]"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        className="px-4 py-2 bg-[#22886c] text-white rounded-lg border-2 border-[#22886c]"
                                    >
                                        Save Changes
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};