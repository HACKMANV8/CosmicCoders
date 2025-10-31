import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "katex/dist/katex.min.css";
import { BlockMath } from "react-katex";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const round = (x, d = 4) =>
  typeof x === "number" ? Number.parseFloat(x.toFixed(d)) : x;

function DatasetPreview({ data }) {
  if (!data || data.length === 0) return null;
  
  const columns = Object.keys(data[0]);
  
  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-xl ring-1 ring-white/10">
      <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <span className="text-2xl">📊</span>
        Dataset Preview
      </h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-white/20">
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left text-white/80 font-medium">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 5).map((row, i) => (
              <tr key={i} className="border-b border-white/10">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-2 text-white/90">
                    {String(row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StepRenderer({ step, currentStep }) {
  if (!step) return null;

  const renderStepContent = () => {
    switch (step.step_number) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-2 font-medium">Algorithm Parameters:</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-blue-300 font-bold text-lg">{step.k_value}</div>
                  <div className="text-white/70 text-sm">K Value</div>
                </div>
                <div className="text-center">
                  <div className="text-green-300 font-bold text-lg">{step.total_features}</div>
                  <div className="text-white/70 text-sm">Features</div>
                </div>
                <div className="text-center">
                  <div className="text-yellow-300 font-bold text-lg">{step.total_classes}</div>
                  <div className="text-white/70 text-sm">Classes</div>
                </div>
                <div className="text-center">
                  <div className="text-purple-300 font-bold text-lg">{step.dataset_size}</div>
                  <div className="text-white/70 text-sm">Samples</div>
                </div>
              </div>
            </div>
            
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-3 font-medium">Available Classes:</div>
              <div className="flex flex-wrap gap-2">
                {step.class_names.map((cls, i) => (
                  <span key={i} className="px-3 py-1 bg-emerald-600/20 text-emerald-200 rounded-full text-sm border border-emerald-400/30">
                    {cls}
                  </span>
                ))}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-3 font-medium">Features Used:</div>
              <div className="flex flex-wrap gap-2">
                {step.feature_names.map((feature, i) => (
                  <span key={i} className="px-3 py-1 bg-blue-600/20 text-blue-200 rounded-full text-sm border border-blue-400/30">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-3 font-medium">Data Preparation Steps:</div>
              <div className="space-y-2">
                {step.preprocessing_steps.map((stepText, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-6 h-6 bg-emerald-600 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">
                      {i + 1}
                    </div>
                    <div className="text-white/90">{stepText}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-blue-600/20 rounded-xl p-4 border border-blue-400/30">
              <div className="text-blue-200 font-medium mb-2">Why Feature Scaling?</div>
              <div className="text-blue-100 text-sm mb-2">{step.scaling_info.method}</div>
              <div className="text-blue-200 text-sm">{step.scaling_info.reason}</div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-3 font-medium">Test Example (Original Values):</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(step.test_example).map(([feature, value]) => (
                  <div key={feature} className="bg-blue-600/20 rounded-lg p-3 border border-blue-400/30">
                    <div className="text-blue-300 text-sm font-medium">{feature}</div>
                    <div className="text-white font-mono text-lg">{String(value)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-3 font-medium">Scaled Features:</div>
              <div className="font-mono text-green-300 bg-black/20 rounded-lg p-3">
                [{step.scaled_features.map(f => f.toFixed(3)).join(', ')}]
              </div>
              <div className="text-xs text-yellow-300 mt-2">
                * Features are standardized to have mean=0 and std=1
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-2 font-medium">Distance Formula:</div>
              <div className="text-center">
                <BlockMath math="d = \sqrt{\sum_{i=1}^{n} (x_i - y_i)^2}" />
              </div>
              <div className="text-xs text-yellow-300 text-center mt-2">
                Euclidean distance between test point and training points
              </div>
            </div>
            
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-3 font-medium">
                {step.k_value} Nearest Neighbors:
              </div>
              <div className="space-y-2">
                {step.neighbors.map((neighbor, i) => (
                  <div key={i} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                        {neighbor.neighbor}
                      </div>
                      <div>
                        <div className="text-white font-medium">Class: {neighbor.class}</div>
                        <div className="text-white/70 text-sm">Index: {neighbor.index}</div>
                      </div>
                    </div>
                    <div className="text-green-300 font-mono">
                      {neighbor.distance.toFixed(4)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-3 font-medium">Vote Counting:</div>
              <div className="space-y-3">
                {step.vote_breakdown.map((vote, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="text-blue-300 font-medium">{vote.class}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-white font-mono">
                        {vote.votes}/{step.total_votes} votes
                      </div>
                      <div className="text-green-300 font-bold">
                        {vote.percentage}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-emerald-600/20 rounded-xl p-4 border border-emerald-400/30">
              <div className="text-center">
                <div className="text-emerald-200 font-medium mb-2">Majority Vote Winner</div>
                <div className="text-emerald-100 text-2xl font-bold">
                  {step.majority_class}
                </div>
                <div className="text-emerald-300 text-sm mt-2">
                  {step.vote_counts[step.majority_class]} out of {step.total_votes} votes
                </div>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className="bg-emerald-600/20 rounded-xl p-6 border border-emerald-400/30">
              <div className="text-center">
                <div className="text-emerald-200 font-medium mb-2">Final Prediction</div>
                <div className="text-emerald-100 text-3xl font-bold mb-2">
                  {step.predicted_class}
                </div>
                <div className="text-emerald-300 text-lg">
                  Confidence: {(step.confidence * 100).toFixed(1)}%
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-3 font-medium">All Class Probabilities:</div>
              <div className="space-y-2">
                {Object.entries(step.all_probabilities).map(([cls, prob]) => (
                  <div key={cls} className={`flex justify-between items-center p-3 rounded-lg ${
                    cls === step.predicted_class ? 'bg-emerald-600/20 border border-emerald-400/30' : 'bg-white/5'
                  }`}>
                    <span className="text-white font-medium">{cls}</span>
                    <span className="font-mono text-green-300">
                      {(prob * 100).toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-600/20 rounded-xl p-4 border border-blue-400/30">
              <div className="text-blue-200 font-medium mb-2">Model Performance</div>
              <div className="text-blue-100">
                Overall Accuracy: <span className="font-bold text-blue-200">{(step.model_accuracy * 100).toFixed(1)}%</span>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-2 font-medium">Interpretation:</div>
              <div className="text-white/90">{step.interpretation}</div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-white/70">
            Step content not available
          </div>
        );
    }
  };

  return (
    <div className="text-left">
      <h3 className="text-xl font-bold text-white mb-2">
        Step {step.step_number}: {step.title}
      </h3>
      <p className="text-white/80 mb-4">{step.description}</p>
      {renderStepContent()}
    </div>
  );
}

function KNNClassification() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [datasetId, setDatasetId] = useState("");
  const [testExample, setTestExample] = useState({});
  const [columns, setColumns] = useState([]);
  const [kValue, setKValue] = useState(5);

  useEffect(() => {
    const id = localStorage.getItem("datasetid");
    if (!id) {
      navigate("/");
      return;
    }
    setDatasetId(id);

    const metaRaw = localStorage.getItem("dataset_meta");
    if (metaRaw) {
      try {
        const meta = JSON.parse(metaRaw);
        setColumns(meta.columns || []);
      } catch (e) {
        console.error("Failed to parse dataset metadata:", e);
      }
    }
  }, [navigate]);

  useEffect(() => {
    if (columns.length > 0) {
      const features = columns.slice(0, -1); // All columns except last (target)
      const initialExample = {};
      features.forEach(col => {
        initialExample[col] = "";
      });
      setTestExample(initialExample);
    }
  }, [columns]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (showAllSteps) return; // Don't navigate when showing all steps
      
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        setCurrentStep(prev => Math.min(prev + 1, (result?.steps?.length || 1) - 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setCurrentStep(prev => Math.max(prev - 1, 0));
      } else if (event.key === 'Escape') {
        setShowAllSteps(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [result?.steps?.length, showAllSteps]);

  const runKNNClassification = async () => {
    if (!datasetId) {
      setError("No dataset selected");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/knnclassification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataset_id: datasetId,
          params: {
            k: kValue,
            example: testExample
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      setResult(data);
      setCurrentStep(0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExampleChange = (feature, value) => {
    setTestExample(prev => ({
      ...prev,
      [feature]: value
    }));
  };

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, (result?.steps?.length || 1) - 1));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const toggleViewMode = () => {
    setShowAllSteps(!showAllSteps);
  };

  if (loading) {
    return (
      <main className="min-h-screen w-full bg-linear-to-br from-sky-700 via-blue-700 to-emerald-600 flex items-center justify-center px-6">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg font-semibold">Loading calculations...</p>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen w-full bg-linear-to-br from-sky-700 via-blue-700 to-emerald-600 flex items-center justify-center px-6">
        <div className="text-center text-white max-w-md">
          <h2 className="text-2xl font-bold mb-4">❌ Error</h2>
          <p className="text-red-200 mb-6">{error}</p>
          <button 
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center rounded-full bg-white/95 text-slate-900 font-semibold px-8 py-3 shadow-xl ring-1 ring-black/10 transition hover:scale-[1.02] hover:shadow-2xl active:scale-100"
          >
            ← Go Back
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-linear-to-br from-sky-700 via-blue-700 to-emerald-600 flex items-center justify-center px-6">
      <div className="text-center max-w-6xl w-full">
        <h1 className="text-white text-4xl md:text-6xl font-extrabold tracking-tight drop-shadow-[0_6px_20px_rgba(0,0,0,0.45)] mb-4">
          K-Nearest Neighbors Classification
        </h1>
        
        <p className="mt-4 text-white/85 mb-8">
          Step-by-step classification based on nearest neighbors
        </p>

        {/* Test Example Input */}
        {columns.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-xl ring-1 ring-white/10">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center justify-center gap-2">
              <span className="text-2xl">🔍</span>
              Test Example & Parameters
            </h3>
            
            {/* K Value Selector */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-white/80 mb-2">
                K Value (Number of Neighbors)
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={kValue}
                onChange={(e) => setKValue(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-32 px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-white/60 text-sm mt-1">
                Recommended: odd numbers (3, 5, 7) to avoid ties
              </p>
            </div>

            <p className="text-white/70 mb-4">
              Enter values for the features you want to classify:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {Object.keys(testExample).map((feature) => (
                <div key={feature}>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    {feature}
                  </label>
                  <input
                    type="text"
                    value={testExample[feature]}
                    onChange={(e) => handleExampleChange(feature, e.target.value)}
                    className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Enter ${feature} value`}
                  />
                </div>
              ))}
            </div>
            <button
              onClick={runKNNClassification}
              disabled={loading || Object.values(testExample).some(v => !v)}
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 text-white font-semibold px-8 py-3 shadow-xl ring-1 ring-emerald-400/20 transition hover:scale-[1.02] hover:shadow-xl active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Running..." : "Classify Example"}
            </button>
          </div>
        )}

        {/* Results */}
        {result && result.steps && result.steps.length > 0 && (
          <>
            {/* Dataset Preview */}
            {result.dataset_preview && (
              <DatasetPreview data={result.dataset_preview} />
            )}

            {/* Controls */}
            <div className="flex justify-center items-center gap-4 mb-6">
              <button
                onClick={toggleViewMode}
                className="inline-flex items-center justify-center rounded-full bg-white/20 text-white font-semibold px-6 py-2 shadow-lg ring-1 ring-white/20 transition hover:scale-[1.02] hover:shadow-xl active:scale-100"
              >
                {showAllSteps ? '📋 Step Mode' : '📄 All Steps'}
              </button>
              
              {!showAllSteps && (
                <>
                  <div className="text-white/80 font-medium">
                    Step {currentStep + 1} of {result.steps.length}
                  </div>
                  <div className="text-white/60 text-sm">
                    Use ← → arrows or click buttons to navigate
                  </div>
                </>
              )}
            </div>

            {/* Progress indicator for step mode */}
            {!showAllSteps && result.steps.length > 0 && (
              <div className="flex justify-center mb-6">
                <div className="flex space-x-2">
                  {result.steps.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentStep(index)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        index === currentStep 
                          ? 'bg-white scale-125' 
                          : index < currentStep 
                            ? 'bg-emerald-400' 
                            : 'bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Steps - Show all or current step */}
            <div className="space-y-6">
              {showAllSteps ? (
                // Show all steps
                result.steps.map((step, idx) => (
                  <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl ring-1 ring-white/10">
                    <StepRenderer step={step} currentStep={idx} />
                  </div>
                ))
              ) : (
                // Show current step only
                <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl ring-1 ring-white/10 transform transition-all duration-300 scale-105">
                  <StepRenderer step={result.steps[currentStep]} currentStep={currentStep} />
                </div>
              )}
            </div>

            {/* Navigation buttons for step mode */}
            {!showAllSteps && result.steps.length > 0 && (
              <div className="flex justify-center items-center gap-4 mt-8">
                <button
                  onClick={prevStep}
                  disabled={currentStep === 0}
                  className="inline-flex items-center justify-center rounded-full bg-white/20 text-white font-semibold px-6 py-3 shadow-lg ring-1 ring-white/20 transition hover:scale-[1.02] hover:shadow-xl active:scale-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Previous
                </button>
                
                <div className="bg-white/10 rounded-full px-4 py-2 text-white font-medium">
                  {currentStep + 1} / {result.steps.length}
                </div>
                
                <button
                  onClick={nextStep}
                  disabled={currentStep === result.steps.length - 1}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-600 text-white font-semibold px-6 py-3 shadow-lg ring-1 ring-emerald-400/20 transition hover:scale-[1.02] hover:shadow-xl active:scale-100 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            )}

            {/* Summary */}
            {result.summary && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mt-6 shadow-xl ring-1 ring-white/10">
                <h3 className="text-xl font-bold text-white mb-4 flex items-center justify-center gap-2">
                  <span className="text-2xl">📊</span>
                  Final Summary
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white">
                  <div className="text-center">
                    <div className="text-sm opacity-75">Prediction</div>
                    <div className="font-bold text-lg text-emerald-300">{result.summary.prediction}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm opacity-75">Confidence</div>
                    <div className="font-bold text-lg text-yellow-300">{result.summary.confidence}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm opacity-75">K Value</div>
                    <div className="font-bold text-lg text-blue-300">{result.summary.k_value}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm opacity-75">Accuracy</div>
                    <div className="font-bold text-lg text-purple-300">{result.summary.accuracy}%</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Back Button */}
        <div className="text-center mt-8">
          <button 
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center rounded-full bg-white/95 text-slate-900 font-semibold px-8 py-3 shadow-xl ring-1 ring-black/10 transition hover:scale-[1.02] hover:shadow-2xl active:scale-100"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </main>
  );
}

export default KNNClassification;