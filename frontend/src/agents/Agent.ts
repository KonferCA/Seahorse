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
import { Wallet } from '@/wallets';
import { NetworkId } from '@/config';

type InitProgressCallback = (update: {
    message: string;
    progress: number;
    ragUpdate?: {
        type: 'email' | 'calendar' | 'document' | 'note';
        total?: number;
        completed?: number;
        error?: number;
        inProgress?: number;
    };
}) => void;

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
    private wallet: Wallet | null = null;

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

        this.wallet = new Wallet({ 
            networkId: NetworkId, 
            createAccessKeyFor: 'contract1.iseahorse.testnet' 
        });
    }

    private async fetchAllProviderData(progressCallback?: InitProgressCallback): Promise<string[]> {
        if (!this.wallet) return [];

        try {
            // get all providers
            const providers = await this.wallet.viewMethod({
                contractId: 'contract1.iseahorse.testnet',
                method: 'get_all_providers',
                args: {}
            });
            console.log('providers received:', providers);

            let totalItems = 0;
            // first pass to count total items
            for (const provider of providers) {
                const data = await this.wallet.viewMethod({
                    contractId: 'contract1.iseahorse.testnet',
                    method: 'get_provider_data',
                    args: { providerId: provider.id }
                });
                console.log('provider data received:', data);
                totalItems += data.length;
            }

            // update rag groups with total count
            if (progressCallback && totalItems > 0) {
                progressCallback({
                    message: 'Loading provider data...',
                    progress: 0.8,
                    ragUpdate: {
                        type: 'document',
                        total: totalItems,
                        completed: 0,
                        error: 0,
                        inProgress: totalItems
                    }
                });
            }

            // fetch and process data
            const allData: string[] = [];
            let processedItems = 0;

            for (const provider of providers) {
                const data = await this.wallet.viewMethod({
                    contractId: 'contract1.iseahorse.testnet',
                    method: 'get_provider_data',
                    args: { providerId: provider.id }
                });
                console.log('provider data received:', data);

                data.forEach((item: { content: string }) => {
                    console.log('processing item:', item);
                    const doc = new Document({
                        pageContent: item.content,
                        metadata: {
                            source: 'provider',
                            providerId: provider.id,
                            providerName: provider.name,
                            type: 'document'
                        }
                    });
                    console.log('created document:', doc);
                    allData.push(doc);
                    processedItems++;
                    
                    if (progressCallback) {
                        progressCallback({
                            message: 'Loading provider data...',
                            progress: 0.8,
                            ragUpdate: {
                                type: 'document',
                                completed: processedItems,
                                inProgress: totalItems - processedItems
                            }
                        });
                    }
                });
            }

            console.log('final allData array:', allData);
            return allData;
        } catch (error) {
            console.error('Error fetching provider data:', error);
            if (progressCallback) {
                progressCallback({
                    message: 'Error loading provider data',
                    progress: 0.8,
                    ragUpdate: {
                        type: 'document',
                        error: 1
                    }
                });
            }
            return [];
        }
    }

    async initialize(progressCallback: InitProgressCallback) {
        try {
            // Start with model loading
            progressCallback({ message: 'Loading AI model...', progress: 0.1 });
            
            // Initialize LLM first
            this.llm = new ChatWebLLM({
                model: this.modelName,
                appConfig: {
                    ...prebuiltAppConfig,
                    useIndexedDBCache: true,
                },
                maxRetries: 10,
                chatOptions: {
                    context_window_size: 8096,
                },
            });

            // Wait for model to initialize
            await this.llm.initialize(progressCallback);
            progressCallback({ message: 'AI model loaded', progress: 0.5 });

            // Initialize embeddings and vector store
            progressCallback({ message: 'Initializing embeddings...', progress: 0.6 });
            this.embeddings = new HuggingFaceTransformersEmbeddings({
                modelName: this.embeddingModelName,
            });

            this.textSplitter = new RecursiveCharacterTextSplitter({
                chunkSize: 500,
                chunkOverlap: 50,
            });

            progressCallback({ message: 'Setting up vector store...', progress: 0.7 });
            this.voyClient = new VoyClient();
            this.vectorStore = new VoyVectorStore(this.voyClient, this.embeddings);

            // Load provider data
            progressCallback({ message: 'Loading provider data...', progress: 0.8 });
            const providerData = await this.fetchAllProviderData(progressCallback);
            console.log('provider data before vector store:', providerData);
            
            if (providerData.length > 0) {
                try {
                    console.log('attempting to add documents to vector store');
                    await this.vectorStore.addDocuments(providerData);
                    console.log('documents successfully added to vector store');
                    this.isVectorStoreEmpty = false;
                } catch (error) {
                    console.error('Error adding documents to vector store:', error);
                    throw error;
                }
            }

            // Initialize chains
            progressCallback({ message: 'Finalizing setup...', progress: 0.9 });
            
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
                        return formatDocumentsAsString(docs);
                    },
                    question: (input: { question: string }) => input.question,
                    today: () => new Date().toDateString(),
                },
                prompt,
                this.llm,
                new StringOutputParser(),
            ]);

            // Create default chain for when no context is available
            const defaultPrompt = ChatPromptTemplate.fromMessages([
                SystemMessagePromptTemplate.fromTemplate(DEFAULT_SYSTEM_PROMPT_TEMPLATE),
                HumanMessagePromptTemplate.fromTemplate('{question}'),
            ]);

            this.defaultChain = RunnableSequence.from([
                {
                    question: (input: { question: string }) => input.question,
                    today: () => new Date().toDateString(),
                },
                defaultPrompt,
                this.llm,
                new StringOutputParser(),
            ]);

            progressCallback({ message: 'Ready!', progress: 1.0 });
        } catch (error) {
            console.error('Error during initialization:', error);
            progressCallback({ 
                message: 'Error initializing system', 
                progress: 0 
            });
            throw error;
        }
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
        console.log('searching with query:', query);
        console.log('vectorStore empty?', this.isVectorStoreEmpty);
        
        if (this.isVectorStoreEmpty) {
            console.log('vector store is empty, returning no results');
            return [];
        }
        
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
            console.error('Error in similaritySearch:', error);
            return [];
        }
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
