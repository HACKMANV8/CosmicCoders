
import './App.css'
import Home from './pages/Home'
import { Routes, Route } from "react-router-dom";
import SimpleLinearRegression from './pages/simplelinearregression';
import NaiveBayes from './pages/naiveBayes';

function App() {

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<div style={{ padding: 24 }}>Not Found</div>} />
      <Route path="/simpleLinearRegression" element={<SimpleLinearRegression />} />
      <Route path="/naiveBayes" element={<NaiveBayes />} />
    </Routes>
  );
}

export default App
