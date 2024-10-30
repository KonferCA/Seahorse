import { HuggingFaceTransformersEmbeddings } from '@langchain/community/embeddings/hf_transformers';
import { VoyVectorStore } from '@langchain/community/vectorstores/voy';
import { Document } from '@langchain/core/documents';
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
            SystemMessagePromptTemplate.fromTemplate(
                "You are a helpful AI assistant. Use the following context to answer the user's question.\n\nContext: {context}\n\nLimit your answers to maximum of 50 words."
            ),
            HumanMessagePromptTemplate.fromTemplate('{question}'),
        ]);

        // Create RAG chain
        this.ragChain = RunnableSequence.from([
            {
                context: async (input: { question: string }) => {
                    const docs = await this.searchSimilar(input.question, 10);
                    docs.forEach((doc) => console.log(doc.pageContent));
                    // console.log(formatDocumentsAsString(docs));
                    return formatDocumentsAsString(docs);
                },
                question: (input: { question: string }) => input.question,
            },
            prompt,
            this.llm,
            new StringOutputParser(),
        ]);

        // Create default prompt template for when no context is available
        const defaultPrompt = ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                "You are a helpful AI assistant. Please answer the user's question to the best of your ability. Limit your answers to maximum of 50 words."
            ),
            HumanMessagePromptTemplate.fromTemplate('{question}'),
        ]);

        // Create default chain, use for when there is nothing in the RAG chain.
        this.defaultChain = RunnableSequence.from([
            {
                question: (input: { question: string }) => input.question,
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
            const documents = await this.textSplitter!.splitDocuments(rawDocuments);
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
            const results = await this.vectorStore!.similaritySearch(query, k);
            return results;
        } catch (error) {
            console.log(error);
        }
        return [];
    }

    async generateResponse(question: string): Promise<string> {
        const streamingCallback: AIStreamCallbacksAndOptions = {
            handleLLMNewToken: (token: string) => {
                this.onToken?.(token);
            },
        };

        try {
            const docs = await this.searchSimilar(question, 10);
            if (docs.length > 0) {
                const response = await this.ragChain!.invoke(
                    { question },
                    { callbacks: [streamingCallback] }
                );
                return response;
            } else {
                const response = await this.defaultChain!.invoke(
                    { question },
                    { callbacks: [streamingCallback] }
                );
                return response;
            }
        } catch (error) {
            console.error('Error generating response:', error);
            throw error;
        }
    }

    setStreamingCallback(callback: (token: string) => void) {
        this.onToken = callback;
    }
}
