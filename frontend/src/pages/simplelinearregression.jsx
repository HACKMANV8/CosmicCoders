import { useEffect, useState,useMemo } from "react";
import { BlockMath, InlineMath } from "react-katex";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, Cell } from 'recharts';
import "katex/dist/katex.min.css";
import { ComposedChart } from 'recharts';

const LinearRegressionSteps = () => {
  const [steps, setSteps] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [metadata, setMetadata] = useState(null);

  useEffect(() => {
  async function fetchCalculation() {
    const datasetId = localStorage.getItem("datasetid");
    
    if (!datasetId) {
      setError("No dataset ID found. Please upload a dataset first.");
      setLoading(false);
      return;
    }

    try {
      console.log("Fetching with dataset ID:", datasetId); // Debug log
      
      const response = await fetch("http://localhost:8000/simplelinearregression", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          algorithm: "linear_regression",
          dataset_id: datasetId,
          params: {}
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Response error:", errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log("Full API result:", result); // See entire response
      console.log("Steps:", result.steps);
      console.log("Chart data:", result.chart_data);
      console.log("Metadata:", result.metadata);
      
      // Set steps
      if (result.steps && result.steps.length > 0) {
        setSteps(result.steps);
        console.log("✓ Steps set:", result.steps.length);
      } else {
        console.warn("No steps in response");
      }
      
      // Set chart data - CHECK ALL POSSIBLE LOCATIONS
      if (result.chart_data && Array.isArray(result.chart_data)) {
        console.log("✓ Setting chart data:", result.chart_data.length, "points");
        setChartData(result.chart_data);
      } else if (result.chartData && Array.isArray(result.chartData)) {
        // Try alternate key name
        console.log("✓ Setting chart data from chartData key:", result.chartData.length);
        setChartData(result.chartData);
      } else {
        console.warn("⚠ No chart_data found in response");
      }
      
      // Set metadata
      if (result.metadata) {
        console.log("✓ Metadata set:", result.metadata);
        setMetadata(result.metadata);
      } else {
        console.warn("⚠ No metadata in response");
      }
      
      // Extract summary
      const lastStep = result.steps?.[result.steps.length - 1];
      if (lastStep && lastStep.summary) {
        setSummary(lastStep.summary);
        console.log("✓ Summary set from last step");
      } else {
        // Create summary from individual steps
        const slopeStep = result.steps?.find(s => s.slope !== undefined);
        const interceptStep = result.steps?.find(s => s.intercept !== undefined);
        const r2Step = result.steps?.find(s => s.r2_score !== undefined);
        
        if (slopeStep && interceptStep) {
          const summaryData = {
            equation: `Salary = ${slopeStep.slope.toFixed(3)} × Years Experience + ${interceptStep.intercept.toFixed(3)}`,
            slope: slopeStep.slope,
            intercept: interceptStep.intercept,
            r2_score: r2Step ? r2Step.r2_score : 0,
            dataset_size: slopeStep.n || 0
          };
          setSummary(summaryData);
          console.log("✓ Summary created from steps:", summaryData);
        }
      }
      
    } catch (err) {
      console.error("Fetch error:", err);
      setError(`Failed to fetch calculation: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  fetchCalculation();
}, []);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyPress = (event) => {
      if (showAllSteps) return; // Don't navigate when showing all steps
      
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

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 0));
  };

  const toggleViewMode = () => {
    setShowAllSteps(!showAllSteps);
  };

  // Custom tooltip for the chart
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
            <div className="border-t border-gray-200 pt-1 mt-2">
              <p className="flex justify-between items-center text-xs">
                <span className="text-gray-600">Error:</span>
                <span className="font-medium text-red-500">{Math.abs(data.y_actual - data.y_predicted).toFixed(2)}</span>
              </p>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };
 // Render interactive chart
  // Replace the RegressionChart function with this:
const RegressionChart = ({ isInStep = false }) => {
  if (!chartData.length || !metadata) {
    console.log("Chart not rendering - chartData:", chartData, "metadata:", metadata);
    return null;
  }

  console.log("Rendering chart with data:", chartData); // Debug log

  const containerClass = isInStep
    ? "bg-linear-to-br from-white/5 to-white/10 backdrop-blur-md rounded-xl p-2 border border-white/20 shadow-2xl h-full"
    : "bg-linear-to-br from-white/10 to-white/5 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-xl ring-1 ring-white/20";

  return (
    <div className={containerClass}>
      {!isInStep && (
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <span className="text-2xl">📈</span>
          Interactive Regression Chart
        </h2>
      )}
      <div className="bg-white rounded-xl p-2 border border-gray-200 shadow-inner h-full">
        <ResponsiveContainer width="100%" height={isInStep ? 400 : 400}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(100,116,139,0.3)" />
            <XAxis
              dataKey="x"
              type="number"
              domain={['dataMin - 0.5', 'dataMax + 0.5']}
              tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }}
              axisLine={{ stroke: 'rgba(100,116,139,0.4)' }}
              tickLine={{ stroke: 'rgba(100,116,139,0.4)' }}
              label={{
                value: metadata?.feature_column ?? 'X',
                position: 'insideBottom',
                offset: -8,
                style: { textAnchor: 'middle', fill: '#374151', fontWeight: 600, fontSize: 12 }
              }}
            />
            <YAxis
              type="number"
              domain={['auto', 'auto']}
              tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }}
              axisLine={{ stroke: 'rgba(100,116,139,0.4)' }}
              tickLine={{ stroke: 'rgba(100,116,139,0.4)' }}
              label={{
                value: metadata?.target_column ?? 'Y',
                angle: -90,
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: '#374151', fontWeight: 600, fontSize: 12 }
              }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Regression line first (so it appears behind points) */}
            <Line 
              type="monotone" 
              dataKey="y_predicted" 
              stroke="#10b981" 
              strokeWidth={2} 
              dot={false} 
              name="Regression Line" 
            />

            {/* Actual points on top */}
            <Scatter 
              name="Actual Data" 
              dataKey="y_actual"
              fill="#60a5fa" 
              stroke="#3b82f6" 
              strokeWidth={1.5}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 text-center">
        <div className="flex justify-center items-center gap-6 text-xs text-white/90 font-medium">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-blue-400 rounded-full shadow-lg border border-blue-300"></div>
            <span>Actual Data</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-emerald-500"></div>
            <span>Regression Line</span>
          </div>
        </div>
      </div>
    </div>
  );
};
  // Helper function to render step content
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

        {step.sample_data && (
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-sm text-white/70 mb-3 font-medium">Sample Predictions:</div>
            <div className="space-y-2">
              {step.sample_data.map((sample, i) => (
                <div key={i} className="flex justify-between items-center text-sm bg-white/5 rounded-lg p-3">
                  <span className="text-white font-medium">
                    X: {sample.x} → Actual: {sample.y_actual.toFixed(0)}
                  </span>
                  <span className="text-green-300 font-bold">
                    Predicted: {sample.y_predicted.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {step.interpretation && (
          <div className="bg-blue-600/20 rounded-xl p-4 mt-3 border border-blue-400/30">
            <div className="text-blue-200">{step.interpretation}</div>
          </div>
        )}

        {/* Display mathematical formulas with KaTeX */}
        {step.step_number === 1 && step.x_mean !== undefined && step.y_mean !== undefined && (
          <div className="mt-4 bg-white/95 rounded-xl p-4 border border-gray-300 shadow-sm">
            <BlockMath math={`\\bar{x} = \\frac{\\sum x_i}{n} = ${step.x_mean.toFixed(3)}`} />
            <BlockMath math={`\\bar{y} = \\frac{\\sum y_i}{n} = ${step.y_mean.toFixed(3)}`} />
          </div>
        )}

        {step.step_number === 2 && step.slope !== undefined && (
          <div className="mt-4 bg-white/95 rounded-xl p-4 border border-gray-300 shadow-sm">
            <BlockMath math={`m = \\frac{\\sum (x_i - \\bar{x})(y_i - \\bar{y})}{\\sum (x_i - \\bar{x})^2} = ${step.slope.toFixed(3)}`} />
          </div>
        )}

        {step.step_number === 3 && step.intercept !== undefined && (
          <div className="mt-4 bg-white/95 rounded-xl p-4 border border-gray-300 shadow-sm">
            <BlockMath math={`c = \\bar{y} - m \\bar{x} = ${step.intercept.toFixed(3)}`} />
          </div>
        )}

        {step.step_number === 4 && step.equation && (
          <div className="mt-4 bg-white/95 rounded-xl p-4 border border-gray-300 shadow-sm">
            <BlockMath math={`y = mx + c`} />
          </div>
        )}

        {step.step_number === 6 && step.r2_score !== undefined && (
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
          Simple Linear Regression
        </h1>
        
        <p className="mt-4 text-white/85 mb-8">
          Step-by-step calculation with your dataset
        </p>

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
                Step {currentStep + 1} of {steps.length}
              </div>
              <div className="text-white/60 text-sm">
                Use ← → arrows or click buttons to navigate
              </div>
            </>
          )}
        </div>

        {/* Progress indicator for step mode */}
        {!showAllSteps && steps.length > 0 && (
          <div className="flex justify-center mb-6">
            <div className="flex space-x-2">
              {steps.map((_, index) => (
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

        {/* Summary - Show only when viewing all steps or on last step */}
        {summary && (showAllSteps || currentStep === steps.length - 1) && (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-xl ring-1 ring-white/10">
            <h2 className="text-xl font-bold text-white mb-4">📊 Final Equation</h2>
            <div className="text-2xl font-mono text-green-300 text-center py-4 bg-black/20 rounded-xl">
              {summary.equation}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-white">
              <div className="text-center">
                <div className="text-sm opacity-75">Slope</div>
                <div className="font-bold text-lg">{summary.slope.toFixed(3)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-75">Intercept</div>
                <div className="font-bold text-lg">{summary.intercept.toFixed(3)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-75">R² Score</div>
                <div className="font-bold text-lg">{summary.r2_score.toFixed(3)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-75">Data Points</div>
                <div className="font-bold text-lg">{summary.dataset_size}</div>
              </div>
            </div>
          </div>
        )}

        {/* Steps - Show all or current step */}
        <div className="space-y-6">
          {showAllSteps ? (
            // Show all steps
            steps.map((step, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl ring-1 ring-white/10">
                {/* For steps 4, 5, 6 show side-by-side layout with chart */}
                {(step.step_number >= 4) ? (
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
            // Show current step only
            steps.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl ring-1 ring-white/10 transform transition-all duration-300 scale-105">
                {/* For steps 4, 5, 6 show side-by-side layout with chart */}
                {(steps[currentStep].step_number >= 4) ? (
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

        {/* Navigation buttons for step mode */}
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

export default LinearRegressionSteps;