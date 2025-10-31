# rag_chain.py
from langchain.chains import RetrievalQA
from langchain.prompts import PromptTemplate
from langchain_ollama import OllamaEmbeddings, OllamaLLM
from langchain_community.vectorstores import Chroma

SYSTEM_PROMPT = """You are a precise tutor. Use ONLY the provided context to answer.
If the answer cannot be found in the context, say "I don't know" and suggest a related query.
Be concise, structured, and include small, concrete examples when helpful.

Context:
{context}

Question:
{question}

Answer (cite facts from context):"""

def get_rag_chain(k: int = 4, score_threshold: float = 0.1):
    embeddings = OllamaEmbeddings(model="mxbai-embed-large")
    vectorstore = Chroma(persist_directory="./chroma_db", embedding_function=embeddings)

    retriever = vectorstore.as_retriever(
        search_kwargs={
            "k": k,
        }
    )

    llm = OllamaLLM(model="llama3.2:3b")

    prompt = PromptTemplate.from_template(SYSTEM_PROMPT)

    qa_chain = RetrievalQA.from_chain_type(
        llm=llm,
        retriever=retriever,
        chain_type="stuff",
        return_source_documents=True,
        chain_type_kwargs={"prompt": prompt},
    )
    return qa_chain
