'use client';
import { CreateMLCEngine, InitProgressCallback } from '@mlc-ai/web-llm';
import { useState } from 'react';

const initProgressCallback: InitProgressCallback = (report) => {
    console.log(report);
}

const selectedModel = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

const engine = await CreateMLCEngine(
    selectedModel,
    { initProgressCallback: initProgressCallback }, 
);

export default function Home() {
    const [prompt, setPrompt] = useState('');

    const query = async () => {
        const reply = await engine.chat.completions.create({
            messages: [
                { role: 'system', content: 'You are a helpful AI assistant.' },
                { role: 'user', content: prompt },
            ],
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
