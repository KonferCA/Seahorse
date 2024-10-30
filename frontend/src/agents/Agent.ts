import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
import { VoyVectorStore } from '@langchain/community/vectorstores/voy';
import { Document, DocumentInterface } from '@langchain/core/documents';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Voy as VoyClient } from 'voy-search';
import { ChatWebLLM } from '@langchain/community/chat_models/webllm';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { formatDocumentsAsString } from 'langchain/util/document';
import {
    ChatPromptTemplate,
    HumanMessagePromptTemplate,
    SystemMessagePromptTemplate,
} from '@langchain/core/prompts';
import { InitProgressCallback, prebuiltAppConfig } from '@mlc-ai/web-llm';

const SYSTEM_PROMPT_TEMPLATE = `
You are a helpful and supportive AI friend.


You know that today is {today}. Use this date as a point of reference when the user's question involves dates.


Do not make up things.
Be concise in your answers.
Do not ramble. Keep the word count under 100 words.


When you don't know the answer, use the following context to answer the user's question. Context: {context}
`;

const DEFAULT_SYSTEM_PROMPT_TEMPLATE = `
You are a helpful and supportive AI friend. Today is {today}. Please answer the question to the best of your abilities.

Do not make up things.
Be concise in your answers.
Do not ramble. Keep the word count under 100 words.
`;

export class Agent {
    private vectorStore: VoyVectorStore | null = null;
    private embeddings: HuggingFaceTransformersEmbeddings | null = null;
    private textSplitter: RecursiveCharacterTextSplitter | null = null;
    private voyClient: VoyClient | null = null;
    private llm: ChatWebLLM | null = null;
    private ragChain: RunnableSequence | null = null;
    private defaultChain: RunnableSequence | null = null;
    protected modelName: string;
    protected embeddingModelName: string;
    private isVectorStoreEmpty: boolean = true;
    private onToken?: (token: string) => void;

    constructor(modelName: string, embeddingModelName?: string) {
        this.modelName = modelName;
        if (!embeddingModelName) {
            // use this model for more accurate results with speed tradeoff.
            // this.embeddingModelName = 'nomic-ai/nomic-embed-text-v1';
            this.embeddingModelName = 'Xenova/all-MiniLM-L6-v2';
            // this.embeddingModelName = 'snowflake-arctic-embed-s-q0f32-MLC-b4';
        } else {
            this.embeddingModelName = embeddingModelName;
        }
    }

    async initialize(progressCallback: InitProgressCallback) {
        this.embeddings = new HuggingFaceTransformersEmbeddings({
            modelName: this.embeddingModelName,
        });
        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 500,
            chunkOverlap: 50,
        });
        this.voyClient = new VoyClient();
        this.vectorStore = new VoyVectorStore(this.voyClient, this.embeddings);
        this.llm = new ChatWebLLM({
            model: this.modelName,
            appConfig: {
                ...prebuiltAppConfig,
                useIndexedDBCache: true,
            },
            maxRetries: 10,
            chatOptions: {
                context_window_size: 2048,
            },
        });
        // await this.llm.reload('Phi-3.5-mini-instruct-q4f16_1-MLC-1k');
        await this.llm.initialize(progressCallback);

        // Create RAG prompt template
        const prompt = ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(SYSTEM_PROMPT_TEMPLATE),
            HumanMessagePromptTemplate.fromTemplate('{question}'),
        ]);

        // Create RAG chain
        this.ragChain = RunnableSequence.from([
            {
                context: async (input: { question: string }) => {
                    if (this.isVectorStoreEmpty) return '';
                    const docs = await this.searchSimilar(input.question, 10);
                    return formatDocumentsAsString(docs.map((doc) => doc[0]));
                },
                question: (input: { question: string }) => input.question,
                today: () => new Date().toDateString(),
            },
            prompt,
            this.llm,
            new StringOutputParser(),
        ]);

        // Create default prompt template for when no context is available
        const defaultPrompt = ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                DEFAULT_SYSTEM_PROMPT_TEMPLATE
            ),
            HumanMessagePromptTemplate.fromTemplate('{question}'),
        ]);

        // Create default chain, use for when there is nothing in the RAG chain.
        this.defaultChain = RunnableSequence.from([
            {
                question: (input: { question: string }) => input.question,
                today: () => new Date().toDateString(),
            },
            defaultPrompt,
            this.llm,
            new StringOutputParser(),
        ]);
    }

    async embedTexts(texts: string[]): Promise<number> {
        try {
            const rawDocuments = texts.map(
                (text) =>
                    new Document({
                        pageContent: text,
                        metadata: { source: 'note', type: 'note' },
                    })
            );
            const documents =
                await this.textSplitter!.splitDocuments(rawDocuments);
            if (this.vectorStore !== null) {
                await this.vectorStore.addDocuments(documents);
            }
            this.isVectorStoreEmpty = false;
            return documents.length;
        } catch (error) {
            console.error('Failed to embed texts:', error);
            throw error;
        }
    }

    async searchSimilar(query: string, k: number) {
        // if (!this.vectorStore) {
        //     throw new Error('No documents have been embedded yet');
        // }
        if (this.isVectorStoreEmpty) return [];
        try {
            const queryVector = await this.embeddings!.embedQuery(query);
            const results = this.vectorStore!.client.search(
                new Float32Array(queryVector),
                k
            );

            const topK: [DocumentInterface<Record<string, any>>, number][] =
                results.neighbors.map(({ id }) => {
                    const docIdx = parseInt(id, 10);
                    const doc = this.vectorStore!.docstore[docIdx].document;
                    const score = this.cosineSimilarity(
                        queryVector,
                        this.vectorStore!.docstore[docIdx].embeddings
                    );
                    return [doc, score];
                });

            console.log(topK);

            return topK;
        } catch (error) {
            console.log(error);
        }
        return [];
    }

    private cosineSimilarity(vecA: number[], vecB: number[]) {
        if (vecA.length !== vecB.length) {
            throw new Error('Vectors must have the same length');
        }

        // Calculate dot product
        const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);

        // Calculate magnitudes
        const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
        const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

        // Calculate cosine similarity
        return dotProduct / (magnitudeA * magnitudeB);
    }

    async generateResponse(question: string): Promise<string> {
        const streamingCallback = {
            handleLLMNewToken: (token: string) => {
                this.onToken?.(token);
            },
        };

        try {
            const response = await this.ragChain!.invoke(
                { question },
                { callbacks: [streamingCallback] }
            );
            return response;
        } catch (error) {
            console.error('Error generating response:', error);
            throw error;
        }
    }

    setStreamingCallback(callback: (token: string) => void) {
        this.onToken = callback;
    }

    async generateDirectResponse(prompt: string): Promise<string> {
        try {
            const response = await this.defaultChain!.invoke({
                question: prompt,
            });
            return response;
        } catch (error) {
            console.error('Error generating direct response:', error);
            throw error;
        }
    }
}
