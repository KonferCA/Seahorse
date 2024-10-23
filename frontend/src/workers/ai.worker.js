import { pipeline, env } from '@xenova/transformers';

env.useBrowserCache = true;
env.allowLocalModels = false;

const MODELS = {
    EMBEDDING: 'Xenova/all-MiniLM-L6-v2'  // demo model
};

let embeddingModel = null;

// handle messages from main thread
self.addEventListener('message', async (event) => {
    const { type, data } = event.data;

    try {
        switch (type) {
            case 'INIT':
                try {
                    console.log('Loading model...');
                    embeddingModel = await pipeline('feature-extraction', MODELS.EMBEDDING);
                    console.log('Model loaded successfully');
                    self.postMessage({ type: 'READY' });
                } catch (error) {
                    console.error('Model initialization failed:', error);
                    self.postMessage({ type: 'ERROR', error: error.message });
                }
                break;

            case 'EMBED':
                if (!embeddingModel) {
                    throw new Error('Embedding model not initialized');
                }
                if (!data?.text) {
                    throw new Error('No text provided for embedding');
                }
                
                console.log(`Processing text${data.isQuery ? ' (query)' : ''}: ${data.text.slice(0, 50)}...`);
                
                const embedding = await embeddingModel(data.text, {
                    pooling: 'mean',
                    normalize: true
                });
                
                console.log(`Generated embedding of length: ${embedding.data.length}`);
                console.log('Embedding vector:', Array.from(embedding.data).slice(0, 5), '...');
                
                self.postMessage({
                    type: 'EMBEDDING_RESULT',
                    data: {
                        embedding: Array.from(embedding.data),
                        isQuery: data.isQuery,
                        docId: data.docId,
                        text: data.text
                    }
                });
                break;

            case 'GENERATE':
                if (!generationModel) {
                    throw new Error('Generation model not initialized');
                }
                
                try {
                    const response = await generationModel(data.prompt, {
                        max_length: 100,
                        temperature: 0.3,
                        do_sample: true,
                        top_p: 0.95
                    });

                    self.postMessage({
                        type: 'GENERATION_RESULT',
                        data: { text: response[0].generated_text }
                    });
                } catch (error) {
                    console.error('Generation error:', error);
                    self.postMessage({
                        type: 'ERROR',
                        error: error.message
                    });
                }
                break;

            default:
                throw new Error(`Unknown message type: ${type}`);
        }
    } catch (error) {
        console.error('Worker error:', error);
        self.postMessage({ type: 'ERROR', error: error.message });
    }
});

self.addEventListener('error', (error) => {
    console.error('Global worker error:', error);
});

self.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled rejection:', event.reason);
});
