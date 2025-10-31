import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

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
              <div className="text-sm text-white/70 mb-2 font-medium">Formula:</div>
              <BlockMath math="P(Class) = \frac{count(Class)}{total\_samples}" />
            </div>
            
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-3 font-medium">Prior Probabilities:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(step.priors || {}).map(([cls, prob]) => (
                  <div key={cls} className="bg-white/5 rounded-lg p-3">
                    <div className="text-blue-300 font-medium">{cls}</div>
                    <div className="font-mono text-green-300">
                      P({cls}) = {step.class_counts?.[cls] || 0}/{step.total_samples} = {round(prob, 4)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-2 font-medium">Formula:</div>
              <BlockMath math="P(Feature=value|Class) = \frac{count(Feature=value, Class) + 1}{count(Class) + unique\_values}" />
              <div className="text-xs text-yellow-300 mt-2">
                * Using Laplace smoothing (+1) to handle unseen values
              </div>
            </div>
            
            <div className="space-y-4">
              {Object.entries(step.likelihoods || {}).map(([cls, features]) => (
                <div key={cls} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-emerald-300 font-bold mb-3">Class: {cls}</div>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {Object.entries(features).map(([feature, values]) => (
                      <div key={feature} className="bg-white/5 rounded-lg p-3">
                        <div className="text-blue-300 font-medium mb-2">{feature}</div>
                        <div className="space-y-1 text-sm">
                          {Object.entries(values).slice(0, 5).map(([value, prob]) => (
                            <div key={value} className="flex justify-between">
                              <span className="text-white/80">{String(value).substring(0, 15)}</span>
                              <span className="font-mono text-green-300">{round(prob, 4)}</span>
                            </div>
                          ))}
                          {Object.keys(values).length > 5 && (
                            <div className="text-white/50 text-xs">... and {Object.keys(values).length - 5} more</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-2 font-medium">Formula:</div>
              <BlockMath math="P(Class|X) \propto P(Class) \times \prod P(Feature_i|Class)" />
            </div>
            
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-3 font-medium">Test Example:</div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {Object.entries(step.test_example || {}).map(([feature, value]) => (
                  <div key={feature} className="bg-blue-600/20 rounded-lg p-2 border border-blue-400/30">
                    <div className="text-blue-300 text-sm">{feature}</div>
                    <div className="font-mono text-white">{String(value)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {Object.entries(step.evidence_terms || {}).map(([cls, data]) => (
                <div key={cls} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-emerald-300 font-bold mb-2">Class: {cls}</div>
                  <div className="text-sm text-white/80 mb-2">Calculation:</div>
                  <div className="bg-white/5 rounded-lg p-3 font-mono text-yellow-300 text-sm">
                    {data.calculation}
                  </div>
                  <div className="mt-2">
                    <span className="text-white/70">Result: </span>
                    <span className="font-mono text-green-300 font-bold">
                      {round(data.unnormalized_posterior, 6)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-4">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-2 font-medium">Formula:</div>
              <BlockMath math="P(Class|X) = \frac{P(Class|X)_{unnormalized}}{Evidence}" />
            </div>
            
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-2 font-medium">Evidence (Normalization Factor):</div>
              <div className="font-mono text-yellow-300 text-lg">
                Evidence = {round(step.evidence, 6)}
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-3 font-medium">Normalized Posterior Probabilities:</div>
              <div className="space-y-2">
                {Object.entries(step.normalized_posteriors || {}).map(([cls, prob]) => (
                  <div key={cls} className="flex justify-between items-center p-3 bg-white/5 rounded-lg">
                    <span className="text-blue-300 font-medium">{cls}</span>
                    <span className="font-mono text-green-300 font-bold">
                      P({cls}|X) = {round(prob, 6)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-4">
            <div className="bg-emerald-600/20 rounded-xl p-6 border border-emerald-400/30">
              <div className="text-center">
                <div className="text-emerald-200 font-medium mb-2">Final Prediction</div>
                <div className="text-emerald-100 text-3xl font-bold mb-2">
                  {step.predicted_class}
                </div>
                <div className="text-emerald-300 text-lg">
                  Confidence: {round(step.confidence * 100, 2)}%
                </div>
              </div>
            </div>

            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="text-sm text-white/70 mb-3 font-medium">All Class Probabilities:</div>
              <div className="space-y-2">
                {Object.entries(step.all_probabilities || {}).map(([cls, prob]) => (
                  <div key={cls} className={`flex justify-between items-center p-3 rounded-lg ${
                    cls === step.predicted_class ? 'bg-emerald-600/20 border border-emerald-400/30' : 'bg-white/5'
                  }`}>
                    <span className="text-white font-medium">{cls}</span>
                    <span className="font-mono text-green-300">
                      {round(prob * 100, 2)}%
                    </span>
                  </div>
                ))}
              </div>
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

function NaiveBayes() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [datasetId, setDatasetId] = useState("");
  const [testExample, setTestExample] = useState({});
  const [columns, setColumns] = useState([]);

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

  const runNaiveBayes = async () => {
    if (!datasetId) {
      setError("No dataset selected");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch(`${API_BASE}/naivebayes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dataset_id: datasetId,
          params: {
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
          Naive Bayes Classification
        </h1>
        
        <p className="mt-4 text-white/85 mb-8">
          Step-by-step probabilistic classification using Bayes' theorem
        </p>

        {/* Test Example Input */}
        {columns.length > 0 && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-xl ring-1 ring-white/10">
            <h3 className="text-xl font-bold text-white mb-4 flex items-center justify-center gap-2">
              <span className="text-2xl">🔍</span>
              Test Example
            </h3>
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
              onClick={runNaiveBayes}
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
                  <span className="text-2xl">�</span>
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
                    <div className="text-sm opacity-75">Dataset Size</div>
                    <div className="font-bold text-lg text-purple-300">{result.summary.dataset_size}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-sm opacity-75">Classes</div>
                    <div className="font-bold text-lg text-pink-300">{result.summary.classes?.length || 0}</div>
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

export default NaiveBayes;
