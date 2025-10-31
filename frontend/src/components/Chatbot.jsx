import { useState, useRef, useEffect } from 'react';

const Chatbot = ({ onToggle }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hi! I'm your ML-Tracer assistant. I can help you understand machine learning algorithms, interpret your results, or answer questions about your data analysis. How can I help you today?",
      isBot: true,
      timestamp: new Date()
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Simulate bot response (replace with actual API call)
  const getBotResponse = async (userMessage) => {
    setIsTyping(true);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
    
    // Mock responses based on keywords
    let response = "I understand you're asking about machine learning. Could you be more specific about what you'd like to know?";
    
    const lowerMessage = userMessage.toLowerCase();
    
    if (lowerMessage.includes('linear regression')) {
      response = "Linear regression is a statistical method that models the relationship between a dependent variable and independent variables. In simple linear regression, we find the best-fit line through data points using the equation y = mx + c. Would you like me to explain any specific part?";
    } else if (lowerMessage.includes('naive bayes')) {
      response = "Naive Bayes is a probabilistic classifier based on Bayes' theorem. It's called 'naive' because it assumes independence between features. It's particularly effective for text classification and spam detection. What aspect would you like me to explain further?";
    } else if (lowerMessage.includes('id3') || lowerMessage.includes('decision tree')) {
      response = "ID3 (Iterative Dichotomiser 3) is a decision tree algorithm that uses information gain to select the best attribute for splitting at each node. It creates a tree structure for classification problems. Would you like to know about information gain or entropy?";
    } else if (lowerMessage.includes('r2') || lowerMessage.includes('r-squared')) {
      response = "R² (R-squared) measures how well your regression model fits the data. It ranges from 0 to 1, where 1 means perfect fit. Values above 0.7 are generally considered good, but this depends on your domain. Your current model's R² can be found in the results section.";
    } else if (lowerMessage.includes('accuracy') || lowerMessage.includes('performance')) {
      response = "Model accuracy depends on the algorithm and data quality. For classification, we look at accuracy, precision, recall, and F1-score. For regression, we examine R², MSE, and residual plots. What specific metrics are you interested in?";
    } else if (lowerMessage.includes('hello') || lowerMessage.includes('hi')) {
      response = "Hello! I'm here to help with your machine learning journey. Are you working on a specific algorithm or do you have questions about your dataset results?";
    } else if (lowerMessage.includes('help')) {
      response = "I can help you with:\n• Understanding ML algorithms (Linear Regression, Naive Bayes, ID3)\n• Interpreting your results and metrics\n• Explaining mathematical formulas\n• Data preprocessing tips\n• Model evaluation\n\nWhat would you like to explore?";
    }
    
    setIsTyping(false);
    return response;
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: inputMessage,
      isBot: false,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');

    // Get bot response
    const botResponse = await getBotResponse(inputMessage);
    const botMessage = {
      id: Date.now() + 1,
      text: botResponse,
      isBot: true,
      timestamp: new Date()
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
    onToggle?.(newState); // Notify parent component about state change
  };

  return (
    <>
      {/* Floating Chat Button - Only show when chat is closed */}
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

      {/* Overlay for responsive behavior */}
      {isOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm lg:hidden" onClick={toggleChat} />
      )}

      {/* Chat Side Panel */}
      {isOpen && (
        <div className={`fixed top-0 right-0 z-40 h-full transition-all duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        } w-full lg:w-96 xl:w-md bg-white/95 backdrop-blur-lg shadow-2xl ring-1 ring-black/10 flex flex-col`}>
          {/* Chat Header */}
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
                  <p className="text-white/80 text-sm">Ready to help with ML concepts</p>
                </div>
              </div>
              
              {/* Minimize Button */}
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

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isBot ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                    message.isBot
                      ? 'bg-gray-100 text-gray-800 rounded-bl-sm'
                      : 'bg-linear-to-r from-blue-600 to-emerald-600 text-white rounded-br-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.text}</p>
                  <p className={`text-xs mt-1 ${message.isBot ? 'text-gray-500' : 'text-white/70'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

          {/* Input Area */}
          <div className="p-4 border-t border-gray-200/50 bg-white/50">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
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