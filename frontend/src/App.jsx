
import './App.css'
import Home from './pages/Home'
import { Routes, Route } from "react-router-dom";
import SimpleLinearRegression from './pages/simplelinearregression';
import NaiveBayes from './pages/naiveBayes';
import Id3Runner from './pages/Id3';
import Chatbot from './components/Chatbot';
import { useState } from 'react';

function App() {
  const [isChatOpen, setIsChatOpen] = useState(false);

  return (
    <>
      {/* Main Content Area - Responsive to chatbot */}
      <div className={`transition-all duration-300 ${
        isChatOpen ? 'lg:mr-96 xl:mr-md' : 'mr-0'
      }`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="*" element={<div style={{ padding: 24 }}>Not Found</div>} />
          <Route path="/simpleLinearRegression" element={<SimpleLinearRegression />} />
          <Route path="/naiveBayes" element={<NaiveBayes />} />
          <Route path="/id3" element={<Id3Runner />} />
        </Routes>
      </div>
      
      {/* Global Chatbot - Available on all pages */}
      <Chatbot onToggle={setIsChatOpen} />
    </>
  );
}

export default App
