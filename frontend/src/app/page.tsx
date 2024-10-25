'use client';
import { CreateMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';
import { useEffect, useRef, useState } from 'react';

export default function Home() {
    const [prompt, setPrompt] = useState('');
    const [progress, setProgress] = useState({
        progress: 0,
        text: '',
        timeElapsed: 0,
    });
    const [response, setResponse] = useState('');
    const engineRef = useRef();

    useEffect(() => {
        // Callback function to update model loading progress
        const initProgressCallback = (initProgress) => {
            setProgress(initProgress);
        };

        const selectedModel = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

        const appConfig = prebuiltAppConfig;
        appConfig.useIndexedDBCache = true;

        const create = async () => {
            const engine = await CreateMLCEngine(
                selectedModel,
                { initProgressCallback: initProgressCallback, appConfig } // engineConfig
            );

            engineRef.current = engine;
        };

        create();
    }, []);

    const query = async () => {
        if (engineRef.current) {
            const reply = await engineRef.current.chat.completions.create({
                messages: [
                    { role: 'system', content: 'You are supportive friend.' },
                    { role: 'user', content: prompt },
                ],
            });
            setResponse(reply.choices[0]?.message.content);
        }
    };

    return (
        <div>
            <div className="flex flex-col text-white mb-4">
                <p>{response}</p>
            </div>
            <div className="flex flex-col gap-2">
                <input
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    className="text-black"
                />
                <button
                    onClick={query}
                    disabled={!engineRef.current}
                    className="padding-4 bg-sky-400"
                >
                    Click
                </button>
            </div>
            <div className="flex flex-col gap-2 text-white">
                <p>{progress.progress}</p>
                <p>{progress.timeElapsed}</p>
                <p>{progress.text}</p>
            </div>
        </div>
    );
}
