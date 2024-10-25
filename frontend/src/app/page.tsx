'use client';
import { CreateMLCEngine } from '@mlc-ai/web-llm';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

// Callback function to update model loading progress
const initProgressCallback = (initProgress) => {
    console.log(initProgress);
};
const selectedModel = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

const engine = await CreateMLCEngine(
    selectedModel,
    { initProgressCallback: initProgressCallback } // engineConfig
);

const messages = [
    { role: 'system', content: 'You are a helpful AI assistant.' },
];

export default function Home() {
    const [prompt, setPrompt] = useState('');

    const query = async () => {
        const reply = await engine.chat.completions.create({
            messages: [...messages, { role: 'user', content: prompt }],
        });
        console.log(reply);
    };

    return (
        <div>
            <input value={prompt} onChange={(e) => setPrompt(e.target.value)} />
            <button onClick={query}>Click</button>
        </div>
    );
}
