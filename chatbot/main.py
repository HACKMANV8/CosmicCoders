import os
import json
from typing import List, Dict, Any

from flask import Flask, request, jsonify
from flask_cors import CORS

from langchain_core.messages import HumanMessage, AIMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.documents import Document

# ---- Ollama (LLM + Embeddings) ----
from langchain_ollama import ChatOllama, OllamaEmbeddings

# Vector store + splitters
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import RecursiveCharacterTextSplitter

# Chains
from langchain.chains import create_retrieval_chain, create_history_aware_retriever
from langchain.chains.combine_documents import create_stuff_documents_chain

# -----------------------
# Configuration
# -----------------------
KB_PATH = os.environ.get("KB_PATH", "./knowledge_base/format.json")
PERSIST_FAISS = os.environ.get("PERSIST_FAISS", "")  # (unused; in-memory for now)
LLM_MODEL = os.environ.get("LLM_MODEL", "llama3.2:3b")         # must exist in Ollama
OLLAMA_EMBED_MODEL = os.environ.get("OLLAMA_EMBED_MODEL", "mxbai-embed-large")
TOP_K = int(os.environ.get("TOP_K", "3"))

# -----------------------
# Helpers
# -----------------------
def load_knowledge_base(path: str) -> List[Document]:
    """
    Expect JSON array of objects:
      [{"id": "...", "question": "...", "answer": "..."}, ...]
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"Knowledge base not found at {path}")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list) or not data:
        raise ValueError("Knowledge base must be a non-empty JSON list.")

    docs: List[Document] = []
    for i, row in enumerate(data):
        q = (row.get("question") or "").strip()
        a = (row.get("answer") or "").strip()
        rid = str(row.get("id", i))
        if not a:
            continue
        content = f"Q: {q}\nA: {a}" if q else a
        docs.append(Document(page_content=content, metadata={"id": rid, "question": q}))
    if not docs:
        raise ValueError("No valid records with non-empty answers found in KB.")
    return docs

def build_retriever() -> Any:
    # Embeddings via Ollama
    embeddings = OllamaEmbeddings(model=OLLAMA_EMBED_MODEL)

    # Load & split KB
    docs = load_knowledge_base(KB_PATH)
    splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = splitter.split_documents(docs)

    # In-memory FAISS index
    vs = FAISS.from_documents(chunks, embeddings)
    return vs.as_retriever(search_kwargs={"k": TOP_K})

def build_rag_chain():
    retriever = build_retriever()

    # 1) History-aware reformulation
    contextualize_q_system_prompt = (
        "Given a chat history and the latest user question that may reference "
        "the chat history, rewrite it as a standalone question. Do NOT answer; "
        "only rewrite or return as-is if already standalone."
    )
    contextualize_q_prompt = ChatPromptTemplate.from_messages(
        [
            ("system", contextualize_q_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ]
    )

    # 2) LLM (Ollama)
    llm = ChatOllama(model=LLM_MODEL)

    # 3) history-aware retriever
    history_aware_retriever = create_history_aware_retriever(
        llm, retriever, contextualize_q_prompt
    )

    # 4) QA Prompt
    qa_system_prompt = (
        "You are a helpful assistant. Use the retrieved context to answer the user's question. "
        "If the answer is not in the context, say you don't know.\n\n"
        "{context}"
    )
    qa_prompt = ChatPromptTemplate.from_messages(
        [
            ("system", qa_system_prompt),
            MessagesPlaceholder("chat_history"),
            ("human", "{input}"),
        ]
    )

    # 5) Stuff documents + chain
    question_answer_chain = create_stuff_documents_chain(llm, qa_prompt)
    rag_chain = create_retrieval_chain(history_aware_retriever, question_answer_chain)
    return rag_chain

# -----------------------
# Flask App
# -----------------------
app = Flask(__name__)
CORS(app, resources={r"/chat": {"origins": "*"}})

try:
    RAG_CHAIN = build_rag_chain()
    INIT_ERROR = None
except Exception as e:
    RAG_CHAIN = None
    INIT_ERROR = str(e)

def normalize_history(history: List[Dict[str, str]]) -> List[Any]:
    """
    Expect history like: [{"role":"user","text":"..."},{"role":"assistant","text":"..."}]
    """
    out: List[Any] = []
    for item in history or []:
        role = (item.get("role") or "").lower()
        text = item.get("text") or ""
        if not text.strip():
            continue
        if role == "assistant":
            out.append(AIMessage(content=text))
        else:
            out.append(HumanMessage(content=text))
    return out

@app.route("/chat", methods=["POST"])
def chat():
    if INIT_ERROR:
        return jsonify({"error": f"RAG init failed: {INIT_ERROR}"}), 500

    data = request.get_json(silent=True) or {}
    query = (data.get("query") or "").strip()
    history = data.get("history", [])  # optional

    if not query:
        return jsonify({"error": "No query provided"}), 400

    chat_history = normalize_history(history)

    try:
        result = RAG_CHAIN.invoke({"input": query, "chat_history": chat_history})
        answer = result.get("answer", "")
        context_docs: List[Document] = result.get("context", []) or []

        sources = []
        for d in context_docs:
            q = d.metadata.get("question")
            if q:
                sources.append(q)

        return jsonify({"answer": answer, "sources": sources, "num_sources": len(sources)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    # Run with: python main.py
    # Ensure: `ollama serve` is running and models are pulled.
    app.run(host="0.0.0.0", port=3000, debug=True)
