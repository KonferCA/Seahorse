import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Note {
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

  // handle opening a note for editing
  const handleNoteClick = (note: Note) => {
    setSelectedNote(note);
    setEditedContent(note.content);
    setEditedTitle(note.title);
  };

  // handle saving edits
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
    <div className="bg-white rounded-lg shadow-lg p-6 mt-4">
      <h2 className="text-lg font-semibold mb-4">📝 Notes</h2>
      
      <div className="space-y-2">
        {notes.map(note => (
          <div 
            key={note.id}
            onClick={() => handleNoteClick(note)}
            className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <div className="flex justify-between items-center">
              <h3 className="font-medium">{note.title}</h3>
              <span className="text-xs text-gray-500">
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
              className="bg-white rounded-lg p-6 w-full max-w-2xl"
            >
              <div className="flex justify-between items-center mb-4">
                <input
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="text-xl font-semibold bg-transparent border-b border-transparent hover:border-gray-300 focus:border-sky-500 focus:outline-none px-1"
                />
                <button 
                  onClick={() => setSelectedNote(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ×
                </button>
              </div>

              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-64 p-3 border rounded-lg mb-4 focus:ring-2 focus:ring-sky-400"
              />

              <div className="flex justify-between gap-2">
                <button
                  onClick={() => {
                    if (selectedNote) {
                      onDelete(selectedNote.id);
                      setSelectedNote(null);
                    }
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Delete Note
                </button>
                <div className="flex gap-2">
                  <button
                    onClick={() => setSelectedNote(null)}
                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded-lg"
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
}
