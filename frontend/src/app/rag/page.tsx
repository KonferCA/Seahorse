'use client';

import { SearchResult } from '@/services/VectorStoreManager';
import { InitProgressReport } from '@mlc-ai/web-llm';
import { useState, useEffect, useRef } from 'react';
import { Agent } from '@/agents/Agent';

export default function VectorStoreDemo() {
    const [texts, setTexts] = useState('');
    const [query, setQuery] = useState('');
    const [response, setResponse] = useState('');
    const [k, setK] = useState(2);
    const [results, setResults] = useState<SearchResult[]>([]);
    const [status, setStatus] = useState('');
    const [progress, setProgress] = useState<InitProgressReport>({
        progress: 0,
        text: 'Not loaded',
        timeElapsed: 0,
    });
    // const vectorStoreManagerRef = useRef<VectorStoreManager | null>(null);
    const agentRef = useRef<Agent | null>(null);

    useEffect(() => {
        const initRAG = async () => {
            if (agentRef.current === null) {
                const agent = new Agent();
                await agent.initialize((progress) => setProgress(progress));
                agentRef.current = agent;
            }
        };

        initRAG();
    }, []);

    // In a real application, these handlers would be in: hooks/useVectorStore.ts
    const handleEmbed = async () => {
        if (!texts.trim()) {
            setStatus('Please enter some text to embed');
            return;
        }

        if (!agentRef.current) {
            setStatus('Worker not running.');
            return;
        }

        try {
            setStatus('Embedding texts...');
            const textsArray = texts
                .split('\n\n')
                .filter((text) => text.trim());
            const count = await agentRef.current.embedTexts(textsArray);
            setStatus(`Successfully embedded ${count} documents`);
        } catch (error) {
            setStatus(
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    };

    const handleQuery = async () => {
        if (!query.trim()) {
            setStatus('Please enter a search query');
            return;
        }

        if (agentRef.current === null) {
            setStatus('Worker not running.');
            return;
        }

        try {
            setStatus('Generating...');
            const response = await agentRef.current.generateResponse(query);
            setResponse(response);
        } catch (error) {
            setStatus(
                `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            setResults([]);
        }
    };

    return (
        <main className="container mx-auto p-4 max-w-4xl">
            <h1 className="text-2xl font-bold mb-6">Vector Store Demo</h1>
            <div>
                <h2 className="text-xl font-semibold mb-2">Model Load</h2>
                <div className="space-y-2">
                    <p className="text-gray-600">{progress.text}</p>
                    <p className="text-gray-600">{progress.progress}</p>
                    <p className="text-gray-600">{progress.timeElapsed}</p>
                </div>
            </div>
            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">Embed Texts</h2>
                <textarea
                    className="w-full h-48 p-2 border rounded"
                    value={texts}
                    onChange={(e) => setTexts(e.target.value)}
                    placeholder="Enter texts to embed (separate different texts with double newline)"
                />
                <button
                    className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                    onClick={handleEmbed}
                >
                    Embed Texts
                </button>
            </div>
            <div className="mb-6">
                <h2 className="text-xl font-semibold mb-2">
                    Search Similar Texts
                </h2>
                <input
                    type="text"
                    className="w-full p-2 border rounded mb-2"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Enter search query"
                />
                <div className="flex gap-2">
                    <input
                        type="number"
                        className="w-24 p-2 border rounded"
                        value={k}
                        onChange={(e) => setK(Number(e.target.value))}
                        min={1}
                    />
                    <button
                        className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                        onClick={handleQuery}
                    >
                        Send
                    </button>
                </div>
            </div>
            <div>
                <p className="text-gray-600 mb-2">{status}</p>
                <p className="text-gray-600 mb-2">{response}</p>
                {results.length > 0 && (
                    <div className="border rounded p-4">
                        <h3 className="font-semibold mb-2">Search Results:</h3>
                        <div className="space-y-4">
                            {results.map((result, index) => (
                                <div
                                    key={index}
                                    className="p-2 bg-gray-50 rounded"
                                >
                                    <p>{result.pageContent}</p>
                                    {result.score && (
                                        <p className="text-sm text-gray-500 mt-1">
                                            Score: {result.score.toFixed(3)}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
