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

interface UseNotesProps {
  engineRef: React.RefObject<any>;
  vectorStoreRef: React.RefObject<any>;
  embeddingModelRef: React.RefObject<any>;
  setRagGroups: React.Dispatch<React.SetStateAction<GroupProgress[]>>;
}

export const useNotes = ({ engineRef, vectorStoreRef, embeddingModelRef, setRagGroups }: UseNotesProps) => {
  const [notes, setNotes] = useState<Note[]>([]);

  // load and process notes on mount
  useEffect(() => {
    const initializeNotes = async () => {
      const storedNotes = localStorage.getItem('voice_notes');
      if (!storedNotes) return;

      const parsedNotes = JSON.parse(storedNotes);
      setNotes(parsedNotes);
      
      if (parsedNotes.length > 0 && vectorStoreRef?.current && embeddingModelRef?.current) {
        // initialize rag group
        setRagGroups(prev => {
          const existingGroup = prev.find(g => g.type === 'note');
          if (existingGroup) return prev;
          
          return [...prev, {
            type: 'note',
            total: parsedNotes.length,
            completed: 0,
            error: 0,
            inProgress: parsedNotes.length
          }];
        });

        // process each note
        for (const note of parsedNotes) {
          try {
            const docId = await vectorStoreRef.current.addDocument(
              note.content,
              {
                type: 'note',
                noteId: note.id,
                title: note.title,
                timestamp: note.timestamp,
                filename: `note_${note.id}.txt`,
              }
            );

            const embedding = await embeddingModelRef.current(note.content, {
              pooling: 'mean',
              normalize: true,
            });

            await vectorStoreRef.current.addEmbedding(
              Array.from(embedding.data),
              docId
            );

            setRagGroups(prev => prev.map(group => 
              group.type === 'note' 
                ? { 
                    ...group, 
                    completed: group.completed + 1,
                    inProgress: group.inProgress - 1
                  }
                : group
            ));
          } catch (error) {
            console.error('error embedding note:', error);
            setRagGroups(prev => prev.map(group => 
              group.type === 'note' 
                ? { 
                    ...group, 
                    error: group.error + 1,
                    inProgress: group.inProgress - 1
                  }
                : group
            ));
          }
        }
      }
    };

    initializeNotes();
  }, [vectorStoreRef?.current, embeddingModelRef?.current]);

  const generateTitle = async (content: string): Promise<string> => {
    if (!engineRef.current) return 'Untitled Note';

    try {
      const reply = await engineRef.current.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'create a 3-5 word title summarizing this note. respond with just the title.'
          },
          { role: 'user', content }
        ],
        max_tokens: 6
      });

      return reply.choices[0]?.message.content || 'Untitled Note';
    } catch (error) {
      console.error('error generating title:', error);
      return 'Untitled Note';
    }
  };

  const saveNote = async (content: string) => {
    const title = await generateTitle(content);
    const newNote = {
      id: Date.now().toString(),
      title,
      content,
      timestamp: Date.now()
    };

    // only try to add to vector store if both refs are available
    if (vectorStoreRef?.current && embeddingModelRef?.current) {
      try {
        setRagGroups(prev => {
          const existingGroup = prev.find(g => g.type === 'note');
          if (existingGroup) {
            return prev.map(g => 
              g.type === 'note' 
                ? { ...g, total: g.total + 1, inProgress: g.inProgress + 1 }
                : g
            );
          }
          return [...prev, {
            type: 'note',
            total: 1,
            completed: 0,
            error: 0,
            inProgress: 1
          }];
        });

        const docId = await vectorStoreRef.current.addDocument(content, {
          type: 'note',
          noteId: newNote.id,
          title: title,
          timestamp: newNote.timestamp
        });

        const embedding = await embeddingModelRef.current(content, {
          pooling: 'mean',
          normalize: true,
        });

        const embeddingArray = Array.from(embedding.data);
        await vectorStoreRef.current.addEmbedding(embeddingArray, docId);

        // save rag data with the note
        newNote.ragData = {
          docId,
          embedding: embeddingArray
        };

        setRagGroups(prev => prev.map(group => 
          group.type === 'note' 
            ? { 
                ...group, 
                completed: group.completed + 1,
                inProgress: group.inProgress - 1
              }
            : group
        ));
      } catch (error) {
        console.error('error adding note to vector store:', error);
        setRagGroups(prev => prev.map(group => 
          group.type === 'note' 
            ? { 
                ...group, 
                error: group.error + 1,
                inProgress: group.inProgress - 1
              }
            : group
        ));
      }
    }

    const updatedNotes = [...notes, newNote];
    setNotes(updatedNotes);
    localStorage.setItem('voice_notes', JSON.stringify(updatedNotes));
  };

  return { notes, saveNote };
};
