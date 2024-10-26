'use client';
import { CreateMLCEngine, prebuiltAppConfig } from '@mlc-ai/web-llm';
import { pipeline, env, FeatureExtractionPipeline } from '@xenova/transformers';
import { useEffect, useRef, useState } from 'react';
import localforage from 'localforage';

const text = `
What I Worked On

February 2021

Before college the two main things I worked on, outside of school, were writing and programming. I didn't write essays. I wrote what beginning writers were supposed to write then, and probably still are: short stories. My stories were awful. They had hardly any plot, just characters with strong feelings, which I imagined made them deep.

The first programs I tried writing were on the IBM 1401 that our school district used for what was then called "data processing." This was in 9th grade, so I was 13 or 14. The school district's 1401 happened to be in the basement of our junior high school, and my friend Rich Draves and I got permission to use it. It was like a mini Bond villain's lair down there, with all these alien-looking machines — CPU, disk drives, printer, card reader — sitting up on a raised floor under bright fluorescent lights.

The language we used was an early version of Fortran. You had to type programs on punch cards, then stack them in the card reader and press a button to load the program into memory and run it. The result would ordinarily be to print something on the spectacularly loud printer.

I was puzzled by the 1401. I couldn't figure out what to do with it. And in retrospect there's not much I could have done with it. The only form of input to programs was data stored on punched cards, and I didn't have any data stored on punched cards. The only other option was to do things that didn't rely on any input, like calculate approximations of pi, but I didn't know enough math to do anything interesting of that type. So I'm not surprised I can't remember any programs I wrote, because they can't have done much. My clearest memory is of the moment I learned it was possible for programs not to terminate, when one of mine didn't. On a machine without time-sharing, this was a social as well as a technical error, as the data center manager's expression made clear.

With microcomputers, everything changed. Now you could have a computer sitting right in front of you, on a desk, that could respond to your keystrokes as it was running instead of just churning through a stack of punch cards and then stopping. [1]

The first of my friends to get a microcomputer built it himself. It was sold as a kit by Heathkit. I remember vividly how impressed and envious I felt watching him sitting in front of it, typing programs right into the computer.

Computers were expensive in those days and it took me years of nagging before I convinced my father to buy one, a TRS-80, in about 1980. The gold standard then was the Apple II, but a TRS-80 was good enough. This was when I really started programming. I wrote simple games, a program to predict how high my model rockets would fly, and a word processor that my father used to write at least one book. There was only room in memory for about 2 pages of text, so he'd write 2 pages at a time and then print them out, but it was a lot better than a typewriter.

Though I liked programming, I didn't plan to study it in college. In college I was going to study philosophy, which sounded much more powerful. It seemed, to my naive high school self, to be the study of the ultimate truths, compared to which the things studied in other fields would be mere domain knowledge. What I discovered when I got to college was that the other fields took up so much of the space of ideas that there wasn't much left for these supposed ultimate truths. All that seemed left for philosophy were edge cases that people in other fields felt could safely be ignored.

I couldn't have put this into words when I was 18. All I knew at the time was that I kept taking philosophy courses and they kept being boring. So I decided to switch to AI.

AI was in the air in the mid 1980s, but there were two things especially that made me want to work on it: a novel by Heinlein called The Moon is a Harsh Mistress, which featured an intelligent computer called Mike, and a PBS documentary that showed Terry Winograd using SHRDLU. I haven't tried rereading The Moon is a Harsh Mistress, so I don't know how well it has aged, but when I read it I was drawn entirely into its world. It seemed only a matter of time before we'd have Mike, and when I saw Winograd using SHRDLU, it seemed like that time would be a few years at most. All you had to do was teach SHRDLU more words.

There weren't any classes in AI at Cornell then, not even graduate classes, so I started trying to teach myself. Which meant learning Lisp, since in those days Lisp was regarded as the language of AI. The commonly used programming languages then were pretty primitive, and programmers' ideas correspondingly so. The default language at Cornell was a Pascal-like language called PL/I, and the situation was similar elsewhere. Learning Lisp expanded my concept of a program so fast that it was years before I started to have a sense of where the new limits were. This was more like it; this was what I had expected college to do. It wasn't happening in a class, like it was supposed to, but that was ok. For the next couple years I was on a roll. I knew what I was going to do.

For my undergraduate thesis, I reverse-engineered SHRDLU. My God did I love working on that program. It was a pleasing bit of code, but what made it even more exciting was my belief — hard to imagine now, but not unique in 1985 — that it was already climbing the lower slopes of intelligence.

I had gotten into a program at Cornell that didn't make you choose a major. You could take whatever classes you liked, and choose whatever you liked to put on your degree. I of course chose "Artificial Intelligence." When I got the actual physical diploma, I was dismayed to find that the quotes had been included, which made them read as scare-quotes. At the time this bothered me, but now it seems amusingly accurate, for reasons I was about to discover.

I applied to 3 grad schools: MIT and Yale, which were renowned for AI at the time, and Harvard, which I'd visited because Rich Draves went there, and was also home to Bill Woods, who'd invented the type of parser I used in my SHRDLU clone. Only Harvard accepted me, so that was where I went.

I don't remember the moment it happened, or if there even was a specific moment, but during the first year of grad school I realized that AI, as practiced at the time, was a hoax. By which I mean the sort of AI in which a program that's told "the dog is sitting on the chair" translates this into some formal representation and adds it to the list of things it knows.

What these programs really showed was that there's a subset of natural language that's a formal language. But a very proper subset. It was clear that there was an unbridgeable gap between what they could do and actually understanding natural language. It was not, in fact, simply a matter of teaching SHRDLU more words. That whole way of doing AI, with explicit data structures representing concepts, was not going to work. Its brokenness did, as so often happens, generate a lot of opportunities to write papers about various band-aids that could be applied to it, but it was never going to get us Mike.

So I looked around to see what I could salvage from the wreckage of my plans, and there was Lisp. I knew from experience that Lisp was interesting for its own sake and not just for its association with AI, even though that was the main reason people cared about it at the time. So I decided to focus on Lisp. In fact, I decided to write a book about Lisp hacking. It's scary to think how little I knew about Lisp hacking when I started writing that book. But there's nothing like writing a book about something to help you learn it. The book, On Lisp, wasn't published till 1993, but I wrote much of it in grad school.

Computer Science is an uneasy alliance between two halves, theory and systems. The theory people prove things, and the systems people build things. I wanted to build things. I had plenty of respect for theory — indeed, a sneaking suspicion that it was the more admirable of the two halves — but building things seemed so much more exciting.

The problem with systems work, though, was that it didn't last. Any program you wrote today, no matter how good, would be obsolete in a couple decades at best. People might mention your software in footnotes, but no one would actually use it. And indeed, it would seem very feeble work. Only people with a sense of the history of the field would even realize that, in its time, it had been good.

There were some surplus Xerox Dandelions floating around the computer lab at one point. Anyone who wanted one to play around with could have one. I was briefly tempted, but they were so slow by present standards; what was the point? No one else wanted one either, so off they went. That was what happened to systems work.

I wanted not just to build things, but to build things that would last.

In this dissatisfied state I went in 1988 to visit Rich Draves at CMU, where he was in grad school. One day I went to visit the Carnegie Institute, where I'd spent a lot of time as a kid. While looking at a painting there I realized something that might seem obvious, but was a big surprise to me. There, right on the wall, was something you could make that would last. Paintings didn't become obsolete. Some of the best ones were hundreds of years old.

And moreover this was something you could make a living doing. Not as easily as you could by writing software, of course, but I thought if you were really industrious and lived really cheaply, it had to be possible to make enough to survive. And as an artist you could be truly independent. You wouldn't have a boss, or even need to get research funding.

I had always liked looking at paintings. Could I make them? I had no idea. I'd never imagined it was even possible. I knew intellectually that people made art — that it didn't just appear spontaneously — but it was as if the people who made it were a different species. They either lived long ago or were mysterious geniuses doing strange things in profiles in Life magazine. The idea of actually being able to make art, to put that verb before that noun, seemed almost miraculous.
`;

export class VectorStore {
    public initialized: boolean;
    public chunkSize: number;
    public chunkOverlap: number;
    public store: LocalForage;

    constructor() {
        this.initialized = false;
        this.chunkSize = 100; // smaller chunks for better relevance
        this.chunkOverlap = 20; // add overlap to maintain context
        this.store = localforage.createInstance({
            name: 'vector-this.store',
            version: 1.0,
        });
    }

    async initialize() {
        if (this.initialized) return;
        await Promise.all([
            this.store.setItem('vectors', []),
            this.store.setItem('metadata', []),
            this.store.setItem('documents', []),
        ]);
        this.initialized = true;
        console.log('Vector this.store initialized');
    }

    chunkText(text) {
        // split into sections first (based on "Section" keyword)
        const sections = text.split(/Section \d+:/);
        const chunks = [];

        sections.forEach((section) => {
            if (!section.trim()) return;

            // split sections into sentences
            const sentences = section.match(/[^.!?]+[.!?]+/g) || [section];
            let currentChunk = [];
            let currentLength = 0;

            sentences.forEach((sentence) => {
                const words = sentence.trim().split(' ');
                if (currentLength + words.length <= this.chunkSize) {
                    currentChunk.push(sentence.trim());
                    currentLength += words.length;
                } else {
                    if (currentChunk.length > 0) {
                        chunks.push(currentChunk.join(' '));
                    }
                    currentChunk = [sentence.trim()];
                    currentLength = words.length;
                }
            });

            if (currentChunk.length > 0) {
                chunks.push(currentChunk.join(' '));
            }
        });

        return chunks;
    }

    async addDocument(text, metadata = {}) {
        if (!this.initialized) await this.initialize();

        const chunks = this.chunkText(text);
        const documents = (await this.store.getItem('documents')) || [];
        const existingMetadata = (await this.store.getItem('metadata')) || [];

        const docId = documents.length;
        documents.push({ text, metadata });

        for (let i = 0; i < chunks.length; i++) {
            existingMetadata.push({
                chunk: chunks[i],
                docId,
                chunkIndex: i,
                ...metadata,
            });
        }

        await this.store.setItem('documents', documents);
        await this.store.setItem('metadata', existingMetadata);
        console.log(`Added document ${docId} with ${chunks.length} chunks`);
        return docId;
    }

    async addEmbedding(embedding, docId) {
        const vectors = (await this.store.getItem('vectors')) || [];
        if (docId !== undefined) {
            vectors.push(embedding);
            await this.store.setItem('vectors', vectors);
            console.log(
                `Added embedding for document ${docId}, total vectors: ${vectors.length}`
            );
        }
    }

    async similaritySearch(queryEmbedding, topK = 3) {
        const vectors = (await this.store.getItem('vectors')) || [];
        const metadata = (await this.store.getItem('metadata')) || [];

        if (vectors.length === 0) return [];
        console.log(vectors);
        console.log(metadata);
        // compute similarities and sort
        const similarities = vectors
            .map((vector, index) => ({
                score: this.cosineSimilarity(queryEmbedding, vector),
                metadata: metadata[index],
            }))
            
            .sort((a, b) => b.score - a.score)
            // filter out low similarity scores
            .filter((item) => item.score > 0.1)
            // take top K results
            .slice(0, topK);

        return similarities.map(({ score, metadata }) => ({
            chunk: metadata.chunk,
            score: score,
        }));
    }

    cosineSimilarity(a, b) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < a.length; i++) {
            dotProduct += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }
}

env.useBrowserCache = true;
env.allowLocalModels = false;

export default function Home() {
    const [prompt, setPrompt] = useState('');
    const [progress, setProgress] = useState({
        progress: 0,
        text: '',
        timeElapsed: 0,
    });
    const [response, setResponse] = useState('');
    const engineRef = useRef();
    const embeddingModelRef = useRef<FeatureExtractionPipeline>();
    const vectorStoreRef = useRef<VectorStore>(new VectorStore());

    useEffect(() => {
        // Callback function to update model loading progress
        const initProgressCallback = (initProgress) => {
            setProgress(initProgress);
        };

        const selectedModel = 'Llama-3.2-1B-Instruct-q4f32_1-MLC';

        const appConfig = prebuiltAppConfig;
        appConfig.useIndexedDBCache = true;

        const create = async () => {
            const [embedModel, engine] = await Promise.all([
                await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2'),
                await CreateMLCEngine(
                    selectedModel,
                    { initProgressCallback: initProgressCallback, appConfig } // engineConfig
                ),
            ]);

            // const embeddings = await embedModel(
            //     'my personal email is: personal_duck_duck@gmail.com',
            //     {
            //         pooling: 'mean',
            //         normalize: true,
            //     }
            // // );
            // const text = 'my personal email is: personal_duck_duck@gmail.com';
            const docId = await vectorStoreRef.current.addDocument(text, {
                filename: 'personal.txt',
                type: 'text/plain',
                size: 50,
            });
            console.log('Added document:', docId);
            const chunks = vectorStoreRef.current.chunkText(text);
            console.log(chunks);
            for (const chunk of chunks) {
                if (chunk && chunk.trim()) {
                    const embeddings = await embedModel(chunk, {
                        pooling: 'mean',
                        normalize: true,
                    });
                    await vectorStoreRef.current.addEmbedding(
                        Array.from(embeddings.data),
                        docId
                    );
                }
            }
            embeddingModelRef.current = embedModel;
            engineRef.current = engine;
        };

        create();
    }, []);

    const query = async () => {
        if (engineRef.current && embeddingModelRef.current) {
            const embeddings = await embeddingModelRef.current(prompt, {
                pooling: 'mean',
                normalize: true,
            });
            
            const results = await vectorStoreRef.current.similaritySearch(
                Array.from(embeddings.data),  // query embedding
                3  // topK parameter (how many chunks we wanna return)
            );
            
            let context = '';
            console.log(results);
            if (results.length) {
                context = results.map((r) => r.chunk).join('\n');
                console.log(context);
            }

            const reply = await engineRef.current.chat.completions.create({
                messages: [
                    { role: 'system', content: 'Here is some context that might help you answer the user\'s query: \n' + context + '\n\n You are supportive friend. Do not hallucinate, be polite and concise. Talk with the user like you are a friend. Keep your responses 1 sentence short, 2 if absolutely required.' },
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
