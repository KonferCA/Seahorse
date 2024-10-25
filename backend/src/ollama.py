from llama_index.core import VectorStoreIndex, StorageContext, Settings
from llama_index.embeddings.huggingface import HuggingFaceEmbedding
from llama_index.vector_stores.milvus import MilvusVectorStore
from llama_index.core import SimpleDirectoryReader
from llama_index.llms.ollama import Ollama

llm = Ollama(model="llama3.2", request_timeout=120.0)
Settings.llm = llm
Settings.embed_model = HuggingFaceEmbedding(
    model_name="BAAI/bge-small-en-v1.5"
)

def main():
    documents = SimpleDirectoryReader(
        input_files=["./data/paul_graham_essay.txt"]
    ).load_data()

    print("Document ID:", documents[0].doc_id)

    vector_store = MilvusVectorStore(uri="./milvus_demo.db", dim=384, overwrite=True)
    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    index = VectorStoreIndex.from_documents(documents, storage_context=storage_context)

    print(index)

    query_engine = index.as_query_engine()
    res = query_engine.query("What did the author learn?")

    print(res)

if __name__ == "__main__":
    main()
    # # Load the model
    # embed_model = HuggingFaceEmbedding(model_name="BAAI/bge-small-en-v1.5")
    #
    # # Test the output size of the embeddings
    # test_embedding = embed_model.get_text_embedding("test sentence")
    # print(f"Embedding size: {len(test_embedding)}")

