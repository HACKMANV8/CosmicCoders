
import './App.css'
import Home from './pages/Home'
import { Routes, Route } from "react-router-dom";
import SimpleLinearRegression from './pages/simplelinearregression';
import NaiveBayes from './pages/naiveBayes';
import Id3Runner from './pages/Id3';
function App() {

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<div style={{ padding: 24 }}>Not Found</div>} />
      <Route path="/simpleLinearRegression" element={<SimpleLinearRegression />} />
      <Route path="/naiveBayes" element={<NaiveBayes />} />
      <Route path="/id3" element={<Id3Runner />} />
    </Routes>
  );
}

export default App
