import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const Card = ({ children, className = "" }) => (
  <div className={`rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 shadow-xl ${className}`}>
    {children}
  </div>
);

const StepNavigation = ({ currentStep, totalSteps, onStepChange }) => (
  <div className="flex justify-center space-x-2 mb-6">
    {Array.from({ length: totalSteps }, (_, i) => (
      <button
        key={i}
        onClick={() => onStepChange(i)}
        className={`w-10 h-10 rounded-full font-medium transition-all ${
          i === currentStep
            ? "bg-blue-600 text-white shadow-lg scale-110"
            : i < currentStep
            ? "bg-green-600/50 text-white hover:bg-green-600/70"
            : "bg-white/10 text-white/60 hover:bg-white/20"
        }`}
      >
        {i + 1}
      </button>
    ))}
  </div>
);

const round = (x, d = 4) =>
  typeof x === "number" ? Number.parseFloat(x.toFixed(d)) : x;

function DatasetPreview({ data }) {
  if (!data || data.length === 0) return null;
  
  const columns = Object.keys(data[0]);
  
  return (
    <Card>
      <h3 className="text-xl font-bold text-white mb-4">📊 Dataset Preview</h3>
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
    </Card>
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
    <Card>
      <div className="text-left">
        <h3 className="text-xl font-bold text-white mb-2">
          Step {step.step_number}: {step.title}
        </h3>
        <p className="text-white/80 mb-4">{step.description}</p>
        {renderStepContent()}
      </div>
    </Card>
  );
}

function NaiveBayes() {
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
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

  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-sky-700 via-blue-700 to-emerald-600 text-white p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">
              🧠 Naive Bayes Classification
            </h1>
            <p className="text-white/80">
              Step-by-step probabilistic classification using Bayes' theorem
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 hover:bg-white/20 transition-all"
          >
            ← Back to Home
          </button>
        </div>

        {/* Test Example Input */}
        {columns.length > 0 && (
          <Card className="mb-6">
            <h3 className="text-xl font-bold text-white mb-4">🔍 Test Example</h3>
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
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-all"
            >
              {loading ? "Running..." : "Classify Example"}
            </button>
          </Card>
        )}

        {/* Error Display */}
        {error && (
          <Card className="mb-6 border-red-400/30 bg-red-600/10">
            <div className="text-red-300">
              <strong>Error:</strong> {error}
            </div>
          </Card>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Dataset Preview */}
            {result.dataset_preview && (
              <div className="mb-6">
                <DatasetPreview data={result.dataset_preview} />
              </div>
            )}

            {/* Step Navigation */}
            {result.steps && result.steps.length > 0 && (
              <>
                <StepNavigation
                  currentStep={currentStep}
                  totalSteps={result.steps.length}
                  onStepChange={setCurrentStep}
                />

                {/* Current Step */}
                <div className="mb-6">
                  <StepRenderer
                    step={result.steps[currentStep]}
                    currentStep={currentStep}
                  />
                </div>

                {/* Navigation Buttons */}
                <div className="flex justify-between mb-6">
                  <button
                    onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
                    disabled={currentStep === 0}
                    className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    ← Previous Step
                  </button>
                  <button
                    onClick={() => setCurrentStep(Math.min(result.steps.length - 1, currentStep + 1))}
                    disabled={currentStep === result.steps.length - 1}
                    className="px-6 py-3 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Next Step →
                  </button>
                </div>

                {/* Summary */}
                {result.summary && (
                  <Card>
                    <h3 className="text-xl font-bold text-white mb-4">📋 Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div><span className="text-white/70">Algorithm:</span> <span className="font-mono text-blue-300">{result.summary.algorithm}</span></div>
                        <div><span className="text-white/70">Prediction:</span> <span className="font-mono text-green-300">{result.summary.prediction}</span></div>
                        <div><span className="text-white/70">Confidence:</span> <span className="font-mono text-yellow-300">{result.summary.confidence}%</span></div>
                      </div>
                      <div className="space-y-2">
                        <div><span className="text-white/70">Dataset Size:</span> <span className="font-mono text-purple-300">{result.summary.dataset_size}</span></div>
                        <div><span className="text-white/70">Features:</span> <span className="font-mono text-cyan-300">{result.summary.features_used?.join(", ")}</span></div>
                        <div><span className="text-white/70">Classes:</span> <span className="font-mono text-pink-300">{result.summary.classes?.join(", ")}</span></div>
                      </div>
                    </div>
                  </Card>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default NaiveBayes;
