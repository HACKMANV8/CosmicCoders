import React from "react";
import { BlockMath, InlineMath } from "react-katex";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, Cell } from 'recharts';
import "katex/dist/katex.min.css";

const  LinearRegressionSteps = () => {
  const [steps, setSteps] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentStep, setCurrentStep] = useState(0);
  const [showAllSteps, setShowAllSteps] = useState(false);
  const [chartData, setChartData] = useState([]);
  const [metadata, setMetadata] = useState(null);

  // Step 1: Compute means
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const meanX = mean(x);
  const meanY = mean(y);

      try {
        const response = await fetch("http://localhost:8000/simplelinearregression", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            algorithm: "linear_regression",
            dataset_id: datasetId,
            params: {} // Let backend auto-detect columns
          })
        });

  // Step 3: Compute intercept (c)
  const c = meanY - m * meanX;

        const result = await response.json();
        console.log("Calculation result:", result);
        
        // Extract steps from the response
        if (result.steps && result.steps.length > 0) {
          setSteps(result.steps);
          
          // Set chart data
          if (result.chart_data) {
            setChartData(result.chart_data);
          }
          
          // Set metadata
          if (result.metadata) {
            setMetadata(result.metadata);
          }
          
          // Extract summary from the last step or create from steps
          const lastStep = result.steps[result.steps.length - 1];
          if (lastStep && lastStep.summary) {
            setSummary(lastStep.summary);
          } else {
            // Create summary from individual steps
            const slopeStep = result.steps.find(s => s.slope !== undefined);
            const interceptStep = result.steps.find(s => s.intercept !== undefined);
            const r2Step = result.steps.find(s => s.r2_score !== undefined);
            
            if (slopeStep && interceptStep) {
              setSummary({
                equation: `Salary = ${slopeStep.slope.toFixed(3)} × Years Experience + ${interceptStep.intercept.toFixed(3)}`,
                slope: slopeStep.slope,
                intercept: interceptStep.intercept,
                r2_score: r2Step ? r2Step.r2_score : 0,
                dataset_size: slopeStep.n || 0
              });
            }
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
        <div className="bg-white/95 border border-gray-300 rounded-lg p-3 shadow-lg">
          <p className="font-semibold text-gray-800">
            {metadata?.feature_column || 'X'}: {label}
          </p>
          <p className="text-blue-600">
            Actual {metadata?.target_column || 'Y'}: {data.y_actual.toFixed(2)}
          </p>
          <p className="text-green-600">
            Predicted {metadata?.target_column || 'Y'}: {data.y_predicted.toFixed(2)}
          </p>
          <p className="text-gray-600 text-sm">
            Error: {Math.abs(data.y_actual - data.y_predicted).toFixed(2)}
          </p>
        </div>
      );
    }
    return null;
  };

  // Render interactive chart
  const RegressionChart = () => {
    if (!chartData.length || !metadata) return null;

    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 shadow-xl ring-1 ring-white/10">
        <h2 className="text-xl font-bold text-white mb-4">📈 Interactive Regression Chart</h2>
        <div className="bg-white/5 rounded-xl p-4">
          <ResponsiveContainer width="100%" height={400}>
            <ScatterChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
              <XAxis 
                dataKey="x" 
                type="number" 
                domain={['dataMin - 0.5', 'dataMax + 0.5']}
                tick={{ fill: '#ffffff80', fontSize: 12 }}
                label={{ 
                  value: metadata.feature_column, 
                  position: 'insideBottom', 
                  offset: -10,
                  style: { textAnchor: 'middle', fill: '#ffffff80' }
                }}
              />
              <YAxis 
                tick={{ fill: '#ffffff80', fontSize: 12 }}
                label={{ 
                  value: metadata.target_column, 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { textAnchor: 'middle', fill: '#ffffff80' }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#ffffff80' }} />
              
              {/* Actual data points */}
              <Scatter 
                name="Actual Data" 
                dataKey="y_actual" 
                fill="#3b82f6"
                r={4}
              />
              
              {/* Predicted values - regression line */}
              <Scatter 
                name="Regression Line" 
                dataKey="y_predicted" 
                fill="#10b981"
                r={2}
                shape="diamond"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 text-center">
          <div className="flex justify-center items-center gap-6 text-sm text-white/80">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Actual Data Points</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500" style={{clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)'}}></div>
              <span>Predicted Values (Regression Line)</span>
            </div>
          </div>
          <p className="text-white/60 text-xs mt-2">
            Hover over points to see actual vs predicted values and prediction error
          </p>
        </div>
      </div>
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
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4 space-y-8">
      <h1 className="text-3xl font-bold text-blue-400 mb-6">
        Simple Linear Regression – Step-by-Step
      </h1>

      {/* Step 1 */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
        <h2 className="text-xl text-green-400 font-semibold mb-3">Step 1: Compute Means</h2>
        <p className="mb-2">
          <InlineMath math={`\\bar{x} = ${meanX.toFixed(2)}, \\quad \\bar{y} = ${meanY.toFixed(2)}`} />
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

        {/* Interactive Chart - Show when viewing all steps or after step 4 */}
        {(showAllSteps || currentStep >= 3) && <RegressionChart />}

        {/* Steps - Show all or current step */}
        <div className="space-y-6">
          {showAllSteps ? (
            // Show all steps
            steps.map((step, idx) => (
              <div key={idx} className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl ring-1 ring-white/10 text-left">
                {renderStepContent(step, idx)}
              </div>
            ))
          ) : (
            // Show current step only
            steps.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 shadow-xl ring-1 ring-white/10 text-left transform transition-all duration-300 scale-105">
                {renderStepContent(steps[currentStep], currentStep)}
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

      {/* Step 2 */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
        <h2 className="text-xl text-yellow-400 font-semibold mb-3">Step 2: Compute Slope (m)</h2>
        <BlockMath math={`m = \\frac{\\sum (x_i - \\bar{x})(y_i - \\bar{y})}{\\sum (x_i - \\bar{x})^2}`} />
        <p className="mt-2">
          <InlineMath math={`m = ${numerator.toFixed(2)} / ${denominator.toFixed(2)} = ${m.toFixed(3)}`} />
        </p>
      </div>

      {/* Step 3 */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
        <h2 className="text-xl text-pink-400 font-semibold mb-3">Step 3: Compute Intercept (c)</h2>
        <BlockMath math={`c = \\bar{y} - m \\bar{x}`} />
        <p className="mt-2">
          <InlineMath math={`c = ${meanY.toFixed(2)} - (${m.toFixed(3)} \\times ${meanX.toFixed(2)}) = ${c.toFixed(3)}`} />
        </p>
      </div>

      {/* Step 4 */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
        <h2 className="text-xl text-purple-400 font-semibold mb-3">Step 4: Prediction</h2>
        <BlockMath math={`y = mx + c`} />
        <p className="mt-2">
          <InlineMath math={`y = (${m.toFixed(3)})(6) + (${c.toFixed(3)}) = ${yPred.toFixed(2)}`} />
        </p>
      </div>

      {/* Final Equation */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4 border border-blue-400">
        <h2 className="text-xl text-blue-400 font-semibold mb-3">Final Regression Line</h2>
        <BlockMath math={`y = ${m.toFixed(3)}x + ${c.toFixed(3)}`} />
      </div>
    </div>
  );
};

export default LinearRegressionSteps;
