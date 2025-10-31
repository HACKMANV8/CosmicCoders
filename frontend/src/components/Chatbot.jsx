import { useState, useRef, useEffect } from 'react';

const Chatbot = ({ onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hi! I'm your ML-Tracer assistant. I can help you understand machine learning algorithms, interpret your results, or answer questions about your data analysis. How can I help you today?",
      isBot: true,
      timestamp: new Date(),
      sources: []
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const API_URL = "http://localhost:3000/chat";

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  // Real API call to your Flask endpoint
  const getBotResponse = async (userMessage) => {
    setIsTyping(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: userMessage })
      });

      if (!res.ok) {
        // Try to read error JSON; otherwise use status text
        let detail = `HTTP ${res.status}`;
        try {
          const j = await res.json();
          detail = j.error || j.detail || detail;
        } catch (e) {
console.log(e);
        }
        throw new Error(detail);
      }

      const data = await res.json();
      const answer = (data && typeof data.answer === "string")
        ? data.answer.trim()
        : "Sorry, I couldn’t parse a response.";

      const sources = Array.isArray(data?.sources) ? data.sources : [];
      return { answer, sources };
    } catch (e) {
      return {
        answer: `⚠️ Error contacting the model: ${e.message}`,
        sources: []
      };
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = async () => {
    const content = inputMessage.trim();
    if (!content || isTyping) return;

    const userMessage = {
      id: Date.now(),
      text: content,
      isBot: false,
      timestamp: new Date(),
      sources: []
    };
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    const { answer, sources } = await getBotResponse(content);

    const botMessage = {
      id: Date.now() + 1,
      text: answer,
      isBot: true,
      timestamp: new Date(),
      sources
    };
    setMessages(prev => [...prev, botMessage]);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleChat = () => {
    const newState = !isOpen;
    setIsOpen(newState);
    onToggle?.(newState);
  };

  return (
    <>
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-2xl transition-all duration-300 flex items-center justify-center ring-2 ring-white/20 bg-linear-to-br from-blue-600 to-emerald-600 hover:scale-110"
        >
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden" onClick={toggleChat} />
      )}

      {isOpen && (
        <div className={`fixed top-0 right-0 z-40 h-full transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } w-full lg:w-96 xl:w-md bg-white/95 backdrop-blur-lg shadow-2xl ring-1 ring-black/10 flex flex-col`}>
          {/* Header */}
          <div className="bg-linear-to-r from-blue-600 to-emerald-600 p-4 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 13V5a2 2 0 00-2-2H4a2 2 0 00-2 2v8a2 2 0 002 2h3l3 3 3-3h3a2 2 0 002-2zM5 7a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1zm1 3a1 1 0 100 2h3a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">ML Assistant</h3>
                  <p className="text-white/80 text-sm">Backed by your local RAG</p>
                </div>
              </div>
              <button
                onClick={toggleChat}
                className="p-2 hover:bg-white/20 rounded-full transition-colors duration-200"
                title="Minimize chat"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.isBot
                      ? 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      : 'bg-linear-to-r from-blue-600 to-emerald-600 text-white rounded-br-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.text}</p>
                  {/* Source chips for bot messages */}
                  {message.isBot && Array.isArray(message.sources) && message.sources.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.sources.map((s, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-white/70 text-gray-800 border border-gray-300"
                          title={s?.snippet || ''}
                        >
                          {/* show a short tag: id or first few words of question */}
                          🧷 {s?.question ? (s.question.length > 28 ? s.question.slice(0, 28) + '…' : s.question) : (s?.id ?? `source-${i+1}`)}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className={`text-xs mt-1 ${message.isBot ? 'text-gray-500' : 'text-white/70'}`}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {/* Typing Indicator */}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-3">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200/50 bg-white/50">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask about ML algorithms, results, or data..."
                className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white/80 backdrop-blur-sm"
                rows={1}
                style={{ maxHeight: '100px' }}
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }}
              />
              <button
                onClick={handleSendMessage}
                disabled={!inputMessage.trim() || isTyping}
                className="px-4 py-2 bg-linear-to-r from-blue-600 to-emerald-600 text-white rounded-xl font-medium shadow-lg transition hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Send"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Chatbot;
