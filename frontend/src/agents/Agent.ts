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
        console.log('searching with query:', query);
        console.log('vectorStore empty?', this.isVectorStoreEmpty);
        
        if (this.isVectorStoreEmpty) {
            console.log('vector store is empty, returning no results');
            return [];
        }
        
        try {
            const results = await this.vectorStore!.similaritySearch(query, k);
            console.log('raw search results:', results);
            
            // get similarity scores from the _similarity property
            return results.map(result => {
                // voy returns similarity scores directly (higher is better)
                const score = (result as any)._similarity || 0;
                
                console.log(`Document: ${result.pageContent.substring(0, 50)}... Score: ${score}`);
                
                return {
                    pageContent: result.pageContent,
                    metadata: {
                        ...result.metadata,
                        score: score
                    }
                };
            });
        } catch (error) {
            console.error('Error in similaritySearch:', error);
            return [];
        }
    }

    async generateResponse(question: string): Promise<string> {
        const streamingCallback: AIStreamCallbacksAndOptions = {
            handleLLMNewToken: (token: string) => {
                this.onToken?.(token);
            },
        };

        try {
            const docs = await this.searchSimilar(question, 10);
            
            // process payouts if we have relevant documents
            if (docs.length > 0) {
                // prepare relevancy data for contract
                const providerScores: { [key: string]: number } = {};
                
                // get highest relevancy score for each provider
                for (const doc of docs) {
                    console.log('Processing doc:', doc); // debug
                    if (doc.metadata?.providerId) {
                        const providerId = doc.metadata.providerId;
                        // ensure we have a valid number between 0 and 1
                        const score = typeof doc.metadata.score === 'number' ? doc.metadata.score : 0;
                        // normalize score to 0-100 range
                        const normalizedScore = Math.floor(score * 100);
                        
                        if (!providerScores[providerId] || normalizedScore > providerScores[providerId]) {
                            providerScores[providerId] = normalizedScore;
                        }
                    }
                }

                // prepare data for contract call
                const queryResults = Object.entries(providerScores).map(([providerId, score]) => ({
                    providerId,
                    relevancyScore: score
                }));

                console.log('Sending payout data:', queryResults); // debug

                // call contract to process payouts
                if (queryResults.length > 0 && this.wallet) {
                    try {
                        await this.wallet.callMethod({
                            contractId: 'contract1.iseahorse.testnet',
                            method: 'process_query',
                            args: { queryResults }
                        });
                        console.log('Payout processed successfully'); // debug
                    } catch (error) {
                        console.error('Error processing provider payouts:', error);
                    }
                }
                
                // generate response
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

    async generateDirectResponse(prompt: string): Promise<string> {
        try {
            const response = await this.defaultChain.invoke({
                question: prompt
            });
            return response;
        } catch (error) {
            console.error('Error generating direct response:', error);
            throw error;
        }
    }
}
