'use client';
import { useState, useEffect, useRef } from 'react';
import { VectorStore } from '@/services/vectorStore';

export const SeahorseChat = () => {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isReady, setIsReady] = useState(false);
    const [documents, setDocuments] = useState([]);
    const [relevantChunks, setRelevantChunks] = useState([]);
    const [currentPrompt, setCurrentPrompt] = useState('');
    // add isProcessing state
    const [isProcessing, setIsProcessing] = useState(false);

    const workerRef = useRef(null);
    const vectorStoreRef = useRef(null);

    useEffect(() => {
        let worker = null;
        
        const initializeWorker = async () => {
            try {
                // create worker
                worker = new Worker(
                    new URL('../workers/ai.worker.js', import.meta.url),
                    { type: 'module' }
                );
                
                // set up error handling
                worker.onerror = (error) => {
                    console.error('Worker error:', error);
                    setMessages(prev => [...prev, {
                        text: 'Error initializing AI system: ' + error.message,
                        sender: 'system'
                    }]);
                };

                // set up message handling
                worker.addEventListener('message', async (event) => {
                    const { type, data, error } = event.data;
                    
                    switch (type) {
                        case 'READY':
                            console.log('AI system initialized');
                            workerRef.current = worker;
                            vectorStoreRef.current = new VectorStore();
                            await vectorStoreRef.current.initialize();
                            setIsReady(true);
                            break;
                        case 'ERROR':
                            console.error('Worker error:', error);
                            setMessages(prev => [...prev, {
                                text: 'AI system error: ' + error,
                                sender: 'system'
                            }]);
                            break;
                        case 'EMBEDDING_RESULT':
                            if (data.isQuery) {
                                const results = await vectorStoreRef.current.similaritySearch(data.embedding);
                                if (results.length > 0) {
                                    const context = results.map(r => r.chunk).join('\n');
                                    setRelevantChunks(results.map(r => ({
                                        text: r.chunk,
                                        score: r.score.toFixed(3)
                                    })));
                                    // store the prompt
                                    setCurrentPrompt(`Context: ${context}\n\nQuestion: ${data.text}\n\nAnswer:`);
                                } else {
                                    setMessages(prev => [...prev, {
                                        text: "I couldn't find any relevant information in the documents.",
                                        sender: 'seahorse'
                                    }]);
                                    setRelevantChunks([]);
                                    setCurrentPrompt('');
                                }
                            } else {
                                await vectorStoreRef.current.addEmbedding(data.embedding, data.docId);
                            }
                            break;
                        case 'GENERATION_RESULT':
                            setMessages(prev => [...prev, {
                                text: data.text,
                                sender: 'seahorse'
                            }]);
                            break;
                    }
                });

                // initialize the worker
                console.log('Initializing AI system...');
                worker.postMessage({ type: 'INIT' });
                
            } catch (error) {
                console.error('Failed to initialize worker:', error);
                setMessages(prev => [...prev, {
                    text: 'Failed to initialize AI system: ' + error.message,
                    sender: 'system'
                }]);
            }
        };

        initializeWorker();

        // cleanup
        return () => {
            if (worker) {
                worker.terminate();
            }
        };
    }, []);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) {
            console.error('No file selected');
            return;
        }

        // validate file type
        if (!file.type.match('text.*') && file.type !== 'application/json') {
            setMessages(prev => [...prev, {
                text: 'Please upload a text or JSON file',
                sender: 'system'
            }]);
            return;
        }

        setIsProcessing(true);
        try {
            const text = await file.text();
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid file content');
            }

            const docId = await vectorStoreRef.current.addDocument(text, {
                filename: file.name,
                type: file.type,
                size: file.size
            });
            
            const chunks = vectorStoreRef.current.chunkText(text);
            for (const chunk of chunks) {
                if (chunk && chunk.trim()) {  // only process non-empty chunks
                    workerRef.current.postMessage({
                        type: 'EMBED',
                        data: { text: chunk, docId }
                    });
                }
            }
            
            setDocuments(prev => [...prev, { id: docId, name: file.name }]);
            setMessages(prev => [...prev, {
                text: `Processed document: ${file.name}`,
                sender: 'system'
            }]);
        } catch (error) {
            console.error('Error processing file:', error);
            setMessages(prev => [...prev, {
                text: `Error processing file: ${error.message}`,
                sender: 'system'
            }]);
        } finally {
            setIsProcessing(false);
            // Clear the file input
            if (e.target) {
                e.target.value = '';
            }
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleSend();
        }
    };

    const handleSend = () => {
        if (!inputMessage.trim() || !isReady) return;

        setMessages(prev => [...prev, {
            text: inputMessage,
            sender: 'user'
        }]);

        workerRef.current.postMessage({
            type: 'EMBED',
            data: { text: inputMessage, isQuery: true }
        });

        setInputMessage('');
    };

    return (
        <div className="flex h-[800px]">
            {/* main chat area */}
            <div className="flex-1 flex flex-col p-4">
                <div className="mb-4">
                    <input
                        type="file"
                        onChange={handleFileUpload}
                        accept=".txt,.json"
                        className="mb-2"
                        disabled={isProcessing || !isReady}
                    />
                    {isProcessing && (
                        <div className="text-sm text-gray-600">Processing document...</div>
                    )}
                    {documents.length > 0 && (
                        <div className="text-sm text-gray-600">
                            <div>Loaded Documents:</div>
                            {documents.map(doc => (
                                <div key={doc.id}>{doc.name}</div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-auto mb-4 border rounded p-4 max-h-[350px]">
                    {messages.map((message, index) => (
                        <div key={index} className={`mb-2 ${message.sender === 'user' ? 'text-right' : ''}`}>
                            <div className={`inline-block p-2 rounded ${
                                message.sender === 'user' ? 'bg-blue-100' : 'bg-gray-100'
                            }`}>
                                {message.text}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={inputMessage}
                        onChange={(e) => setInputMessage(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Ask a question about your documents..."
                        className="flex-1 p-2 border rounded"
                    />
                    <button
                        onClick={handleSend}
                        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    >
                        Send
                    </button>
                </div>
            </div>

            <div className="w-1/3 p-4 border-l overflow-auto">
                <h3 className="font-bold mb-2">Relevant Chunks</h3>
                {relevantChunks.map((chunk, index) => (
                    <div key={index} className="mb-4 p-3 bg-gray-50 rounded shadow-sm">
                        <div className="text-sm text-gray-500 mb-1">
                            Similarity: {chunk.score}
                        </div>
                        <div className="text-sm">
                            {chunk.text}
                        </div>
                    </div>
                ))}
                {currentPrompt && (
                    <div className="mt-6">
                        <h3 className="font-bold mb-2">Generated Prompt</h3>
                        <div className="p-3 bg-blue-50 rounded shadow-sm">
                            <pre className="text-sm whitespace-pre-wrap">
                                {currentPrompt}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
