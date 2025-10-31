import { useEffect, useState } from "react";

import { BlockMath } from "react-katex";
import "katex/dist/katex.min.css";


import {
  ScatterChart, Scatter, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, ComposedChart
} from 'recharts';

// --- FIX 2: Remove problematic CSS import ---
// The line below caused 61 build errors because the bundler
// doesn't know how to handle the .woff2 and .ttf font files.
// We will load this CSS dynamically instead.
// import "katex/dist/katex.min.css";

// This new component will render the SVR results
const SupportVectorRegressionSteps = () => {
  const [steps, setSteps] = useState([]);
  const [summary, setSummary] = useState(null); // Will be populated from metadata
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [metadata, setMetadata] = useState(null);

  // --- FIX 3: Dynamically load KaTeX CSS ---
  // This hook injects the KaTeX CSS file directly into the
  // document's <head>, bypassing the bundler and solving
  // all the font loading errors.
  useEffect(() => {
    const katexCssId = 'katex-css';
    if (!document.getElementById(katexCssId)) {
      const link = document.createElement('link');
      link.id = katexCssId;
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.10/dist/katex.min.css';
      link.integrity = 'sha384-sN/aDmrS3B+IYhtAigCSjkyzKoNeVPn+NBbHqnSyLgGbUf2UiMUpLIdfW3F0lCif';
      link.crossOrigin = 'anonymous';
      document.head.appendChild(link);
    }
  }, []);

  useEffect(() => {
    async function fetchCalculation() {
      // Get dataset ID from localStorage
      const datasetId = localStorage.getItem("datasetid");
      
      if (!datasetId) {
        setError("No dataset ID found. Please upload a dataset first.");
        setLoading(false);
        return;
      }

      try {
        // --- MODIFICATION: Call the new SVR endpoint ---
        const response = await fetch("http://localhost:8000/supportvectorregression", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataset_id: datasetId,
            params: {} // Send empty params, backend will use defaults for C & epsilon
          })
        });

        if (!response.ok) {
          const errData = await response.json();
          throw new Error(`HTTP error! status: ${response.status} - ${errData.detail}`);
        }

        const result = await response.json();
        console.log("SVR Calculation result:", result);
        
        if (result.steps && result.steps.length > 0) {
          setSteps(result.steps);
          
          if (result.chart_data) {
            setChartData(result.chart_data);
          }
          
          // The metadata object is the primary source for the summary
          if (result.metadata) {
            setMetadata(result.metadata);
            // --- MODIFICATION: Set summary from metadata ---
            setSummary({
              equation: result.metadata.equation,
              slope: result.metadata.slope,
              intercept: result.metadata.intercept,
              r2_score: result.metadata.r2_score,
              epsilon: result.metadata.epsilon,
              C: result.metadata.C,
              unscaled_epsilon: result.metadata.unscaled_epsilon,
              support_vector_count: result.metadata.support_vector_count
            });
          }
        }
      } catch (err) {
        console.error("Fetch error:", err);
        setError(`Failed to fetch SVR calculation: ${err.message}`);
      } finally {
        setLoading(false);
      }
    }

    fetchCalculation();
  }, []);

  // Handle keyboard navigation (no changes)
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (showAllSteps) return;
      if (event.key === 'ArrowRight' || event.key === ' ') {
        event.preventDefault();
        setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setCurrentStep(prev => Math.max(prev - 1, 0));
      } else if (event.key === 'Escape') {
        setShowAllSteps(true);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [steps.length, showAllSteps]);

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 0));
  const toggleViewMode = () => setShowAllSteps(!showAllSteps);

  // --- MODIFICATION: Custom tooltip for SVR chart ---
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-linear-to-br from-white/95 to-white/90 backdrop-blur-lg border border-white/30 rounded-xl p-4 shadow-2xl ring-1 ring-black/5">
          <p className="font-bold text-gray-800 text-sm mb-2">
            {metadata?.feature_column || 'X'}: <span className="text-blue-600">{label}</span>
          </p>
          <div className="space-y-1 text-sm">
            <p className="flex justify-between items-center">
              <span className="text-gray-700">Actual {metadata?.target_column || 'Y'}:</span>
              <span className="font-semibold text-blue-600">{data.y_actual.toFixed(2)}</span>
            </p>
            <p className="flex justify-between items-center">
              <span className="text-gray-700">Predicted {metadata?.target_column || 'Y'}:</span>
              <span className="font-semibold text-green-600">{data.y_predicted.toFixed(2)}</span>
            </p>
            <p className="flex justify-between items-center">
              <span className="text-gray-700">Upper Boundary:</span>
              <span className="font-semibold text-yellow-600">{data.upper_boundary.toFixed(2)}</span>
            </p>
            <p className="flex justify-between items-center">
              <span className="text-gray-700">Lower Boundary:</span>
              <span className="font-semibold text-yellow-600">{data.lower_boundary.toFixed(2)}</span>
            </p>
            <div className="border-t border-gray-200 pt-1 mt-2">
              <p className="flex justify-between items-center text-xs">
                <span className="text-gray-600">Support Vector:</span>
                <span className={`font-medium ${data.is_support_vector ? 'text-red-500' : 'text-gray-500'}`}>
                  {data.is_support_vector ? 'Yes' : 'No'}
                </span>
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  // --- MODIFICATION: Render SVR chart ---
  const RegressionChart = ({ isInStep = false }) => {
    if (!chartData.length || !metadata) {
      return null;
    }
    const containerClass = isInStep 
      ? "bg-linear-to-br from-white/5 to-white/10 backdrop-blur-md rounded-xl p-2 border border-white/20 shadow-2xl h-full"
      : "bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-xl ring-1 ring-white/20";

    return (
      <div className={containerClass}>
        {!isInStep && (
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">📈</span>
            SVR Interactive Chart
          </h2>
        )}
        <div className="bg-white rounded-xl p-2 border border-gray-200 shadow-inner h-full">
          <ResponsiveContainer width="100%" height={isInStep ? 400 : 400}>
            {/* Use ComposedChart to layer Scatter and Line */}
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.3)" />
              <XAxis 
                dataKey="x" 
                type="number" 
                domain={['dataMin - 0.5', 'dataMax + 0.5']}
                tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }}
                axisLine={{ stroke: 'rgba(100,116,139,0.4)'}}
                tickLine={{ stroke: 'rgba(100,116,139,0.4)'}}
                label={{ value: metadata.feature_column, position: 'insideBottom', offset: -8, style: { textAnchor: 'middle', fill: '#374151', fontWeight: 600, fontSize: 12 }}}
              />
              <YAxis 
                tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }}
                axisLine={{ stroke: 'rgba(100,116,139,0.4)'}}
                tickLine={{ stroke: 'rgba(100,116,139,0.4)'}}
                label={{ value: metadata.target_column, angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#374151', fontWeight: 600, fontSize: 12 }}}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Regression Line */}
              <Line 
                dataKey="y_predicted" 
                stroke="#34d399" 
                strokeWidth={2} 
                dot={false}
                name="Regression Line"
              />
              {/* Epsilon Boundaries */}
              <Line 
                dataKey="upper_boundary" 
                stroke="#f59e0b" 
                strokeWidth={1.5} 
                strokeDasharray="5 5" 
                dot={false}
                name="ε-Tube"
              />
              <Line 
                dataKey="lower_boundary" 
                stroke="#f59e0b" 
                strokeWidth={1.5} 
                strokeDasharray="5 5" 
                dot={false}
                name="ε-Tube"
              />
              
              {/* Actual data points. Support vectors are red, others are blue */}
              <Scatter name="Actual Data" dataKey="y_actual" r={6}>
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={entry.is_support_vector ? '#ef4444' : '#60a5fa'} // Red for support, blue for others
                    stroke={entry.is_support_vector ? '#dc2626' : '#3b82f6'}
                    strokeWidth={1.5}
                  />
                ))}
              </Scatter>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-3 text-center">
          <div className="flex flex-wrap justify-center items-center gap-4 text-xs text-white/90 font-medium">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full shadow-lg border border-blue-300"></div>
              <span>Data Point</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full shadow-lg border border-red-400"></div>
              <span>Support Vector</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-green-400"></div>
              <span>Regression Line</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-yellow-500 border-b-2 border-dashed border-yellow-500"></div>
              <span>ε-Tube</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // --- MODIFICATION: Render SVR step content ---
  const renderStepContent = (step, idx) => {
    return (
      <>
        <h3 className="text-xl font-bold text-white mb-2">
          Step {step.step_number}: {step.title}
        </h3>
        <p className="text-white/80 mb-4">{step.description}</p>
        
        {step.formula && (
          <div className="bg-white/5 rounded-xl p-4 mb-3 border border-white/10">
            <div className="text-sm text-white/70 mb-1 font-medium">Formula:</div>
            <div className="font-mono text-yellow-300 text-lg">{step.formula}</div>
          </div>
        )}

        {step.calculation && (
          <div className="bg-white/5 rounded-xl p-4 mb-3 border border-white/10">
            <div className="text-sm text-white/70 mb-1 font-medium">Calculation:</div>
            <div className="font-mono text-green-300 text-lg">{step.calculation}</div>
          </div>
        )}

        {step.equation && (
          <div className="bg-emerald-600/20 rounded-xl p-4 mb-3 border border-emerald-400/30">
            <div className="text-sm text-emerald-200 mb-1 font-medium">Final Equation:</div>
            <div className="font-mono text-emerald-100 text-xl font-bold">{step.equation}</div>
          </div>
        )}

        {step.interpretation && (
          <div className="bg-blue-600/20 rounded-xl p-4 mt-3 border border-blue-400/30">
            <div className="text-blue-200">{step.interpretation}</div>
          </div>
        )}

        {/* Display mathematical formulas with KaTeX for SVR */}
        {step.step_number === 1 && step.unscaled_epsilon !== undefined && (
          <div className="mt-4 bg-white/95 rounded-xl p-4 border border-gray-300 shadow-sm">
            <BlockMath math={`C = ${step.C}`} />
            <BlockMath math={`\\epsilon = ${step.epsilon} \\text{ (scaled)}`} />
            <BlockMath math={`\\epsilon_{\\text{unscaled}} = ${step.unscaled_epsilon.toFixed(3)}`} />
          </div>
        )}

        {step.step_number === 2 && (
          <div className="mt-4 bg-white/95 rounded-xl p-4 border border-gray-300 shadow-sm">
            <BlockMath math={`z = \\frac{x - \\mu}{\\sigma}`} />
          </div>
        )}
        
        {step.step_number === 3 && (
          <div className="mt-4 bg-white/95 rounded-xl p-4 border border-gray-300 shadow-sm text-sm">
            <BlockMath math={`\\text{Minimize: } \\frac{1}{2} ||w||^2 + C \\sum_{i=1}^{n} (\\xi_i + \\xi_i^*)`} />
          </div>
        )}

        {step.step_number === 4 && step.slope !== undefined && (
          <div className="mt-4 bg-white/95 rounded-xl p-4 border border-gray-300 shadow-sm">
            <BlockMath math={`w = \\frac{w_{\\text{scaled}} \\times \\sigma_y}{\\sigma_x} = ${step.slope.toFixed(3)}`} />
          </div>
        )}

        {step.step_number === 5 && step.intercept !== undefined && (
          <div className="mt-4 bg-white/95 rounded-xl p-4 border border-gray-300 shadow-sm">
            <BlockMath math={`b = b_{\\text{scaled}} \\times \\sigma_y + \\mu_y - w \\times \\mu_x = ${step.intercept.toFixed(3)}`} />
          </div>
        )}
        
        {step.step_number === 7 && step.support_vector_count !== undefined && (
           <div className="mt-4 bg-white/95 rounded-xl p-4 border border-gray-300 shadow-sm">
            <BlockMath math={`|y_i - (wx_i + b)| \\ge \\epsilon`} />
          </div>
        )}

        {step.step_number === 8 && step.r2_score !== undefined && (
          <div className="mt-4 bg-white/95 rounded-xl p-4 border border-gray-300 shadow-sm">
            <BlockMath math={`R^2 = 1 - \\frac{SS_{res}}{SS_{tot}} = ${step.r2_score.toFixed(3)}`} />
          </div>
        )}
      </>
    );
  };

  if (loading) {
    return (
      <main className="min-h-screen w-full bg-linear-to-br from-sky-700 via-blue-700 to-emerald-600 flex items-center justify-center px-6">
        <div className="text-center text-white">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
          <p className="text-lg font-semibold">Loading SVR calculations...</p>
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

  // --- Main Render ---
  return (
    <main className="min-h-screen w-full bg-linear-to-br from-sky-700 via-blue-700 to-emerald-600 flex items-center justify-center px-6 py-12">
      <div className="text-center max-w-6xl w-full">
        <h1 className="text-white text-4xl md:text-6xl font-extrabold tracking-tight drop-shadow-[0_6px_20px_rgba(0,0,0,0.45)] mb-4">
          Support Vector Regression
        </h1>
        
        <p className="mt-4 text-white/85 mb-8">
          Step-by-step calculation with your dataset
        </p>

        {/* Controls (no change) */}
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
                Step {currentStep + 1} of {steps.length}
              </div>
              <div className="text-white/60 text-sm">
                Use ← → arrows or click buttons to navigate
              </div>
            </>
          )}
        </div>

        {/* Progress indicator (no change) */}
        {!showAllSteps && steps.length > 0 && (
          <div className="flex justify-center mb-6">
            <div className="flex space-x-2">
              {steps.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentStep(index)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    index === currentStep ? 'bg-white scale-125' : index < currentStep ? 'bg-emerald-400' : 'bg-white/30'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* --- MODIFICATION: SVR Summary --- */}
        {summary && (showAllSteps || currentStep === steps.length - 1) && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-xl ring-1 ring-white/10">
            <h2 className="text-xl font-bold text-white mb-4">📊 Final Model</h2>
            <div className="text-2xl font-mono text-green-300 text-center py-4 bg-black/20 rounded-xl">
              {summary.equation}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 text-white">
              <div className="text-center">
                <div className="text-sm opacity-75">Slope (w)</div>
                <div className="font-bold text-lg">{summary.slope.toFixed(3)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-75">Intercept (b)</div>
                <div className="font-bold text-lg">{summary.intercept.toFixed(3)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-75">R² Score</div>
                <div className="font-bold text-lg">{summary.r2_score.toFixed(3)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-75">Unscaled Epsilon (±)</div>
                <div className="font-bold text-lg">{summary.unscaled_epsilon.toFixed(3)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-75">Cost (C)</div>
                <div className="font-bold text-lg">{summary.C}</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-75">Support Vectors</div>
                <div className="font-bold text-lg">{summary.support_vector_count}</div>
              </div>
            </div>
          </div>
        )}

        {/* Steps (Chart logic updated) */}
        <div className="space-y-6">
          {showAllSteps ? (
            steps.map((step, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl ring-1 ring-white/10">
                {/* Show chart from step 6 onwards */}
                {(step.step_number >= 6) ? (
                  <div className="grid lg:grid-cols-2 gap-6 items-stretch min-h-[500px]">
                    <div className="text-left">
                      {renderStepContent(step, idx)}
                    </div>
                    <div className="lg:sticky lg:top-6 h-full">
                      <RegressionChart isInStep={true} />
                    </div>
                  </div>
                ) : (
                  <div className="text-left">
                    {renderStepContent(step, idx)}
                  </div>
                )}
              </div>
            ))
          ) : (
            steps.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl ring-1 ring-white/10 transform transition-all duration-300 scale-105">
                {/* Show chart from step 6 onwards */}
                {(steps[currentStep].step_number >= 6) ? (
                  <div className="grid lg:grid-cols-2 gap-6 items-stretch min-h-[500px]">
                    <div className="text-left">
                      {renderStepContent(steps[currentStep], currentStep)}
                    </div>
                    <div className="lg:sticky lg:top-6 h-full">
                      <RegressionChart isInStep={true} />
                    </div>
                  </div>
                ) : (
                  <div className="text-left">
                    {renderStepContent(steps[currentStep], currentStep)}
                  </div>
                )}
              </div>
            )
          )}
        </div>

        {/* Navigation buttons (no change) */}
        {!showAllSteps && steps.length > 0 && (
          <div className="flex justify-center items-center gap-4 mt-8">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="inline-flex items-center justify-center rounded-full bg-white/20 text-white font-semibold px-6 py-3 shadow-lg ring-1 ring-white/20 transition hover:scale-[1.02] hover:shadow-xl active:scale-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ← Previous
            </button>
            <div className="bg-white/10 rounded-full px-4 py-2 text-white font-medium">
              {currentStep + 1} / {steps.length}
            </div>
            
            <button
              onClick={nextStep}
              disabled={currentStep === steps.length - 1}
              className="inline-flex items-center justify-center rounded-full bg-emerald-600 text-white font-semibold px-6 py-3 shadow-lg ring-1 ring-emerald-400/20 transition hover:scale-[1.02] hover:shadow-xl active:scale-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next →
            </button>
          </div>
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
};

export default SupportVectorRegressionSteps;

