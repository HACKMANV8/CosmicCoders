from flask import Flask, request, jsonify
from flask_cors import CORS
from rag_chain import get_rag_chain

app = Flask(__name__)
CORS(app, resources={r"/chat": {"origins": "http://localhost:5173"}})

qa_chain = get_rag_chain()

@app.route("/chat", methods=["POST"])
def chat():
    data = request.get_json() or {}
    query = data.get("query", "")
    if not query:
        return jsonify({"error": "No query provided"}), 400

    try:
        result = qa_chain.invoke({"query": query})
        answer = result.get("result", "")
        source_docs = result.get("source_documents", []) or []
        sources = [doc.metadata.get("question", "") for doc in source_docs]
        return jsonify({"answer": answer, "sources": sources})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=3000, debug=True)
