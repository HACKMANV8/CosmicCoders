import json
from langchain_ollama import OllamaEmbeddings
from langchain_community.vectorstores import Chroma

def build_vectorstore():
    with open("knowledge_base/knowledge_base.json", "r") as f:
        data = json.load(f)

    texts = [d["answer"] for d in data]
    metadatas = [{"id": d["id"], "question": d["question"]} for d in data]

    embeddings = OllamaEmbeddings(model="llama3.2:3b")

    vectorstore = Chroma.from_texts(texts, embedding=embeddings, metadatas=metadatas, persist_directory="./chroma_db")

    vectorstore.persist()
    print("Knowledge base loaded into ChromaDB")

if __name__ == "__main__":
    build_vectorstore()