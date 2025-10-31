import React, { useEffect, useMemo, useState } from "react";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const Card = ({ children, className = "" }) => (
  <div className={`bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl ring-1 ring-white/10 ${className}`}>
    {children}
  </div>
);

const round = (x, d = 6) =>
  typeof x === "number" ? Number.parseFloat(x.toFixed(d)) : x;

function pickTarget(columns = []) {
  if (!Array.isArray(columns) || columns.length === 0) return null;
  const pri = [
    "target",
    "label",
    "class",
    "y",
    "output",
    "play",
    "result",
    "category",
  ];
  const lower = columns.map((c) => String(c));
  const match = lower.find((c) => pri.includes(c.toLowerCase()));
  return match || lower[lower.length - 1];
}

export default function Id3AutoRunner() {
  const [datasetId, setDatasetId] = useState("");
  const [columns, setColumns] = useState([]);
  const [autoTarget, setAutoTarget] = useState(null);
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [showAllSteps, setShowAllSteps] = useState(false);

  // 1) Load dataset id + columns from localStorage
  useEffect(() => {
    // you said it's saved under 'datasetid'
    const id = localStorage.getItem("datasetid") || "";
    setDatasetId(id);

    // if you saved the /datasets response earlier, read columns here
    // (recommended: localStorage.setItem('dataset_meta', JSON.stringify(responseJson)))
    const metaRaw = localStorage.getItem("dataset_meta");
    let cols = [];
    try {
      if (metaRaw) {
        const meta = JSON.parse(metaRaw);
        if (Array.isArray(meta?.columns)) cols = meta.columns;
      }
    } catch {
      // ignore
    }
    setColumns(cols);
  }, []);

  // 2) Decide target + features automatically whenever columns change
  useEffect(() => {
    if (!columns || columns.length === 0) {
      setAutoTarget(null);
      setFeatures([]);
      return;
    }
    const t = pickTarget(columns);
    setAutoTarget(t);
    setFeatures(columns.filter((c) => c !== t));
  }, [columns]);

  useEffect(() => {
    const canRun = datasetId && autoTarget;
    if (!canRun) return;

    const run = async () => {
      setLoading(true);
      setError("");
      setResult(null);
      try {
        const body = {
          algorithm: "id3",
          dataset_id: datasetId,
          params: {
            target: autoTarget,
            features: features.length ? features : undefined,
          },
        };
        const r = await fetch(`${API_BASE}/id3`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!r.ok) {
          const txt = await r.text();
          throw new Error(`${r.status} ${txt}`);
        }
        const j = await r.json();
        console.log("ID3 Result:", j); // Debug log to see the actual data structure
        setResult(j);
      } catch (e) {
        setError(String(e.message || e));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [datasetId, autoTarget, features]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (showAllSteps || !result?.steps) return; // Don't navigate when showing all steps
      
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        setCurrentStep(prev => Math.min(prev + 1, result.steps.length - 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setCurrentStep(prev => Math.max(prev - 1, 0));
      } else if (event.key === 'Escape') {
        setShowAllSteps(true);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [showAllSteps, result?.steps]);

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, (result?.steps?.length || 1) - 1));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const toggleViewMode = () => {
    setShowAllSteps(!showAllSteps);
  };

  // Extract root split info from steps
  const getRootSplitInfo = () => {
    if (!result?.steps) return { feature: null, gain: null };
    
    // Look for split choice step
    const splitChoiceStep = result.steps.find(s => s.formula_id === "split_choose_feature");
    if (splitChoiceStep?.context?.chosen_feature) {
      const feature = splitChoiceStep.context.chosen_feature;
      // Find the gain for this feature from candidates
      const candidates = splitChoiceStep.context.candidates || [];
      const gainEntry = candidates.find(([f, g]) => f === feature);
      const gain = gainEntry ? gainEntry[1] : null;
      return { feature, gain };
    }
    
    // Alternative: look for gain calculation steps
    const gainSteps = result.steps.filter(s => s.formula_id === "gain_feature_breakdown");
    if (gainSteps.length > 0) {
      // Find the step with highest gain
      let bestFeature = null;
      let bestGain = -1;
      
      gainSteps.forEach(step => {
        const feature = step.context?.feature;
        const gain = step.result?.gain;
        if (feature && gain !== undefined && gain > bestGain) {
          bestFeature = feature;
          bestGain = gain;
        }
      });
      
      return { 
        feature: bestFeature, 
        gain: bestGain >= 0 ? bestGain : null 
      };
    }
    
    return { feature: null, gain: null };
  };

  const rootSplitInfo = result ? getRootSplitInfo() : { feature: null, gain: null };

  const StepRenderer = ({ step }) => {
    switch (step.formula_id) {
      case "entropy_multiclass":
        return <EntropyStep step={step} />;
      case "gain_feature_breakdown":
        return <GainFeatureBreakdown step={step} />;
      case "split_choose_feature":
        return <SplitChooseFeature step={step} />;
      default:
        return <GenericStep step={step} />;
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen w-full bg-linear-to-br from-sky-700 via-blue-700 to-emerald-600 flex items-center justify-center px-6">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg font-semibold">Building decision tree...</p>
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
          ID3 Decision Tree
        </h1>
        
        <p className="mt-4 text-white/85 mb-8">
          Step-by-step tree construction with your dataset
        </p>

        {/* Dataset Info */}
        <Card className="mb-6">
          <div className="text-left">
            <h3 className="text-xl font-bold text-white mb-4">📊 Dataset Configuration</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white">
              <div>
                <div className="text-sm text-white/70 mb-1">Target Variable</div>
                <div className="font-mono text-emerald-300 text-lg">
                  {autoTarget || "Auto-detecting..."}
                </div>
              </div>
              <div>
                <div className="text-sm text-white/70 mb-1">Features</div>
                <div className="font-mono text-blue-300 text-sm">
                  {features.length ? features.join(", ") : "Loading..."}
                </div>
              </div>
            </div>
          </div>
        </Card>

        {result && (
          <>
            {/* Controls */}
            <div className="flex justify-center items-center gap-4 mb-6">
              <button
                onClick={toggleViewMode}
                className="inline-flex items-center justify-center rounded-full bg-white/20 text-white font-semibold px-6 py-2 shadow-lg ring-1 ring-white/20 transition hover:scale-[1.02] hover:shadow-xl active:scale-100"
              >
                {showAllSteps ? '📋 Step Mode' : '📄 All Steps'}
              </button>
              
              {!showAllSteps && result.steps && (
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
            {!showAllSteps && result.steps && result.steps.length > 0 && (
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

            {/* Summary */}
            <Card className="mb-6">
              <h2 className="text-xl font-bold text-white mb-4">🌳 Decision Tree Summary</h2>
              
             
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-white">
                <div className="text-center">
                  <div className="text-sm opacity-75">Root Split Feature</div>
                  <div className="font-bold text-lg text-emerald-300">
                    {rootSplitInfo.feature || 
                     result.best?.feature || 
                     result.feature_summaries?.[0]?.feature || 
                     "—"}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm opacity-75">Information Gain</div>
                  <div className="font-bold text-lg">
                    {rootSplitInfo.gain !== null ? round(rootSplitInfo.gain, 3) :
                     result.best?.gain ? round(result.best.gain, 3) : 
                     result.feature_summaries?.[0]?.gain ? round(result.feature_summaries[0].gain, 3) :
                     "—"}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-sm opacity-75">Tree Depth</div>
                  <div className="font-bold text-lg">
                    {result.steps?.length || 0} levels
                  </div>
                </div>
              </div>

              {Array.isArray(result.feature_summaries) && result.feature_summaries.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-lg font-semibold text-white mb-3">Feature Information Gains</h4>
                  <div className="bg-white/5 rounded-xl p-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                      {result.feature_summaries.map((r, i) => (
                        <div key={i} className="bg-white/5 rounded-lg p-3 border border-white/10">
                          <div className="font-mono text-blue-300 text-sm">{r.feature}</div>
                          <div className="font-bold text-white text-lg">{round(r.gain, 3)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Card>

            {/* Steps */}
            {result.steps && result.steps.length > 0 && (
              <div className="space-y-6">
                {showAllSteps ? (
                  // Show all steps
                  result.steps.map((step, idx) => (
                    <div key={step.step_id ?? `${step.node_id}-${step.order}`}>
                      <StepRenderer step={step} />
                    </div>
                  ))
                ) : (
                  // Show current step only
                  <div className="transform transition-all duration-300 scale-105">
                    <StepRenderer step={result.steps[currentStep]} />
                  </div>
                )}
              </div>
            )}

            {/* Navigation buttons for step mode */}
            {!showAllSteps && result.steps && result.steps.length > 0 && (
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

/* ===== Step renderers ===== */

function EntropyStep({ step }) {
  const counts = step?.vars?.counts || {};
  const total = step?.vars?.total || 0;
  const Hs = step?.result?.entropy;

  return (
    <Card>
      <div className="text-left">
        <h3 className="text-xl font-bold text-white mb-4">📊 Entropy Calculation</h3>
        <p className="text-white/80 mb-4">
          Calculate the entropy of the dataset to measure impurity before splitting.
        </p>
        
        <div className="bg-white/95 rounded-xl p-4 border border-gray-300 shadow-sm mb-4">
          <BlockMath math={"H(S) = -\\sum_c p(c)\\log_2 p(c)"} />
        </div>
        
        <div className="bg-white/5 rounded-xl p-4 mb-4 border border-white/10">
          <div className="text-sm text-white/70 mb-3 font-medium">Class Distribution:</div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(counts).map(([cls, n]) => {
              const p = total ? (n / total).toFixed(4) : "—";
              return (
                <div key={cls} className="bg-white/5 rounded-lg p-3">
                  <div className="font-mono text-blue-300 text-sm">{cls}</div>
                  <div className="font-bold text-white">{n} samples</div>
                  <div className="text-white/70 text-xs">p = {p}</div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="bg-emerald-600/20 rounded-xl p-4 border border-emerald-400/30">
          <div className="text-emerald-200 font-medium">Result:</div>
          <div className="font-mono text-emerald-100 text-xl font-bold">
            H(S) = {round(Hs, 3)}
          </div>
        </div>
      </div>
    </Card>
  );
}

function GainFeatureBreakdown({ step }) {
  const base = step?.vars?.base_entropy;
  const total = step?.vars?.total || 0;
  const parts = step?.vars?.parts || [];
  const feature = step?.context?.feature || "?";
  const weightedSum = step?.result?.weighted_sum;
  const gain = step?.result?.gain;

  return (
    <Card>
      <div className="text-left">
        <h3 className="text-xl font-bold text-white mb-2">
          📈 Information Gain: <span className="text-emerald-300">{feature}</span>
        </h3>
        <p className="text-white/80 mb-4">
          Calculate how much information we gain by splitting on this feature.
        </p>
        
        <div className="bg-white/95 rounded-xl p-4 border border-gray-300 shadow-sm mb-4">
          <BlockMath math={"\\text{Gain}(S, A) = H(S) - \\sum_v \\frac{|S_v|}{|S|} H(S_v)"} />
        </div>
        
        <div className="bg-white/5 rounded-xl p-4 mb-4 border border-white/10">
          <div className="text-sm text-white/70 mb-1 font-medium">Base Entropy:</div>
          <div className="font-mono text-yellow-300 text-lg">
            H(S) = {round(base, 3)} (Total samples: {total})
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div className="text-white font-medium mb-2">Feature Value Breakdowns:</div>
          {parts.map((p, idx) => (
            <div key={idx} className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-white/70 mb-2">
                    Value: <span className="font-mono text-blue-300">{String(p.value)}</span>
                  </div>
                  <div className="text-sm">
                    Samples: <span className="font-mono">{p.size}</span> | 
                    Weight: <span className="font-mono">{round(p.weight, 3)}</span>
                  </div>
                  <div className="text-sm mt-1">
                    Classes: {Object.entries(p.class_counts)
                      .map(([k, v]) => `${k}:${v}`)
                      .join(", ")}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-white/70 mb-1">Entropy Calculation:</div>
                  <div className="bg-white/5 rounded-lg p-2">
                    <div className="text-xs font-mono">
                      {Array.isArray(p.p_terms)
                        ? p.p_terms.map((t) => `p(${t.class})=${round(t.p, 3)}`).join(", ")
                        : "—"}
                    </div>
                    <div className="font-bold text-emerald-300 mt-1">
                      H(S_v) = {round(p.entropy, 3)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white/5 rounded-xl p-4 mb-3 border border-white/10">
          <div className="text-sm text-white/70 mb-1 font-medium">Weighted Sum:</div>
          <div className="font-mono text-green-300 text-lg">
            Σ weight × H(S_v) = {round(weightedSum, 3)}
          </div>
        </div>

        <div className="bg-emerald-600/20 rounded-xl p-4 border border-emerald-400/30">
          <div className="text-emerald-200 font-medium">Information Gain:</div>
          <div className="font-mono text-emerald-100 text-xl font-bold">
            Gain(S, {feature}) = {round(gain, 3)}
          </div>
        </div>
      </div>
    </Card>
  );
}

function SplitChooseFeature({ step }) {
  const chosen = step?.context?.chosen_feature;
  const cands = step?.context?.candidates || [];
  
  return (
    <Card>
      <div className="text-left">
        <h3 className="text-xl font-bold text-white mb-4">🎯 Feature Selection</h3>
        <p className="text-white/80 mb-4">
          Choose the feature with the highest information gain for splitting.
        </p>
        
        <div className="bg-white/5 rounded-xl p-4 border border-white/10">
          <div className="text-sm text-white/70 mb-3 font-medium">Candidate Features:</div>
          <div className="space-y-2">
            {cands.map(([f, g], i) => (
              <div key={i} className={`flex justify-between items-center p-3 rounded-lg ${
                f === chosen 
                  ? 'bg-emerald-600/20 border border-emerald-400/30' 
                  : 'bg-white/5 border border-white/10'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-blue-300">{f}</span>
                  {f === chosen && <span className="text-emerald-300 text-lg">★</span>}
                </div>
                <div className="font-mono text-white font-bold">{round(g, 3)}</div>
              </div>
            ))}
          </div>
        </div>
        
        {chosen && (
          <div className="bg-emerald-600/20 rounded-xl p-4 mt-4 border border-emerald-400/30">
            <div className="text-emerald-200 font-medium">Selected Root Feature:</div>
            <div className="font-mono text-emerald-100 text-xl font-bold">{chosen}</div>
          </div>
        )}
      </div>
    </Card>
  );
}

function GenericStep({ step }) {
  return (
    <Card>
      <div className="text-left">
        <h3 className="text-xl font-bold text-white mb-2">
          {step.type} 
          <span className="text-white/60 text-base ml-2">({step.formula_id})</span>
        </h3>
        
        {step.vars && (
          <div className="bg-white/5 rounded-xl p-4 mb-3 border border-white/10">
            <div className="text-sm text-white/70 mb-1 font-medium">Variables:</div>
            <pre className="text-xs whitespace-pre-wrap wrap-break-word text-white/90 font-mono">
              {JSON.stringify(step.vars, null, 2)}
            </pre>
          </div>
        )}
        
        {step.result && (
          <div className="bg-emerald-600/20 rounded-xl p-4 border border-emerald-400/30">
            <div className="text-emerald-200 font-medium mb-1">Result:</div>
            <div className="font-mono text-emerald-100 text-lg">
              {JSON.stringify(step.result, null, 2)}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
