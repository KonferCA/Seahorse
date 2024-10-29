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

    async initialize(progressCallback: InitProgressCallback) {
        this.embeddings = new HuggingFaceTransformersEmbeddings({
            // use this model if speed is preferred over accuracy
            modelName: 'Xenova/all-MiniLM-L6-v2',
            // modelName: 'nomic-ai/nomic-embed-text-v1',
        });
        this.textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 500,
            chunkOverlap: 50,
        });
        this.voyClient = new VoyClient();
        this.vectorStore = new VoyVectorStore(this.voyClient, this.embeddings);
        this.llm = new ChatWebLLM({
            model: 'Phi-3.5-mini-instruct-q4f16_1-MLC-1k',
            appConfig: {
                ...prebuiltAppConfig,
                useIndexedDBCache: true,
            },
            maxRetries: 10,
        });
        // await this.llm.reload('Phi-3.5-mini-instruct-q4f16_1-MLC-1k');
        await this.llm.initialize(progressCallback);

        // Create RAG prompt template
        const prompt = ChatPromptTemplate.fromMessages([
            SystemMessagePromptTemplate.fromTemplate(
                "You are a helpful AI assistant. Use the following context to answer the user's question.\n\nContext: {context}"
            ),
            HumanMessagePromptTemplate.fromTemplate('{question}'),
        ]);

        // Create RAG chain
        this.ragChain = RunnableSequence.from([
            {
                context: async (input: { question: string }) => {
                    const docs = await this.searchSimilar(input.question, 10);
                    return formatDocumentsAsString(docs);
                },
                question: (input: { question: string }) => input.question,
            },
            prompt,
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
                        metadata: { source: 'browser-data' },
                    })
            );
            const documents =
                await this.textSplitter!.splitDocuments(rawDocuments);
            if (this.vectorStore !== null) {
                await this.vectorStore.addDocuments(documents);
            }
            return documents.length;
        } catch (error) {
            throw new Error(
                `Failed to embed texts: ${(error as Error).message}`
            );
        }
    }

    async searchSimilar(query: string, k: number) {
        if (!this.vectorStore) {
            throw new Error('No documents have been embedded yet');
        }
        return this.vectorStore.similaritySearch(query, k);
    }

    async generateResponse(query: string): Promise<string> {
        try {
            const response = await this.ragChain!.invoke({
                question: query,
            });
            return response;
        } catch (error) {
            throw new Error(
                `Failed to generate response: ${(error as Error).message}`
            );
        }
    }
}
