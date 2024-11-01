import { useState, useEffect } from 'react';

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

import { Agent } from '@/agents/Agent';

interface UseNotesProps {
    agent: Agent | null;
    setRagGroups: React.Dispatch<React.SetStateAction<GroupProgress[]>>;
}

export const useNotes = ({ agent, setRagGroups }: UseNotesProps) => {
    const [notes, setNotes] = useState<Note[]>([]);

    // load and process notes on mount
    useEffect(() => {
        const initializeNotes = async () => {
            const storedNotes = localStorage.getItem('voice_notes');
            if (!storedNotes) return;

            const parsedNotes = JSON.parse(storedNotes);
            setNotes(parsedNotes);

            if (parsedNotes.length > 0 && agent) {
                // initialize rag group
                setRagGroups((prev) => {
                    const existingGroup = prev.find((g) => g.type === 'note');
                    if (existingGroup) return prev;

                    return [
                        ...prev,
                        {
                            type: 'note',
                            total: parsedNotes.length,
                            completed: 0,
                            error: 0,
                            inProgress: parsedNotes.length,
                        },
                    ];
                });

                // process each note
                for (const note of parsedNotes) {
                    try {
                        const docId = await agent.embedTexts([
                            `NOTE: ${note.content}`,
                        ]);

                        setRagGroups((prev) =>
                            prev.map((group) =>
                                group.type === 'note'
                                    ? {
                                        ...group,
                                        completed: group.completed + 1,
                                        inProgress: group.inProgress - 1,
                                    }
                                    : group
                            )
                        );
                    } catch (error) {
                        console.error('error embedding note:', error);
                        setRagGroups((prev) =>
                            prev.map((group) =>
                                group.type === 'note'
                                    ? {
                                        ...group,
                                        error: group.error + 1,
                                        inProgress: group.inProgress - 1,
                                    }
                                    : group
                            )
                        );
                    }
                }
            }
        };

        initializeNotes();
    }, [agent]);

    const generateTitle = async (content: string): Promise<string> => {
        if (!agent) return 'Untitled Note';

        try {
            const response = await agent.generateDirectResponse(
                `create a 3-5 word title summarizing this note: "${content}". respond with just the title.`
            );
            return (response || 'Untitled Note').replace(/"/g, '');
        } catch (error) {
            console.error('error generating title:', error);
            return 'Untitled Note';
        }
    };

    const deleteNote = async (noteId: string) => {
        const updatedNotes = notes.filter((note) => note.id !== noteId);
        setNotes(updatedNotes);
        localStorage.setItem('voice_notes', JSON.stringify(updatedNotes));
    };

    const saveNote = async (content: string) => {
        const title = await generateTitle(content);
        const newNote = {
            id: Date.now().toString(),
            title,
            content,
            timestamp: Date.now(),
        };

        if (agent) {
            try {
                const docCount = await agent.embedTexts([`NOTE: ${content}`]);
                setRagGroups((prev) => {
                    const existingGroup = prev.find((g) => g.type === 'note');
                    if (existingGroup) {
                        return prev.map((g) =>
                            g.type === 'note'
                                ? { ...g, total: g.total + 1, completed: 1 }
                                : g
                        );
                    }
                    return [
                        ...prev,
                        {
                            type: 'note',
                            total: 1,
                            completed: 1,
                            error: 0,
                            inProgress: 0,
                        },
                    ];
                });
            } catch (error) {
                console.error('error adding note to vector store:', error);
                setRagGroups((prev) =>
                    prev.map((group) =>
                        group.type === 'note'
                            ? {
                                ...group,
                                error: group.error + 1,
                            }
                            : group
                    )
                );
            }
        }

        const updatedNotes = [...notes, newNote];
        setNotes(updatedNotes);
        localStorage.setItem('voice_notes', JSON.stringify(updatedNotes));
    };

    return { notes, saveNote, deleteNote };
};
