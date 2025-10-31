import { useEffect, useState } from "react";
import { BlockMath, InlineMath } from "react-katex";
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import "katex/dist/katex.min.css";

const KNNRegressionSteps = () => {
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
        const response = await fetch("http://localhost:8000/knnregression", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataset_id: datasetId,
            params: {
              k: 3 // Default K value
            }
          })
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        console.log("KNN Calculation result:", result);
        
        if (result.steps && result.steps.length > 0) {
          setSteps(result.steps);
          
          if (result.chart_data) {
            setChartData(result.chart_data);
          }
          
          if (result.metadata) {
            setMetadata(result.metadata);
          }
          
          // Extract summary from the last step
          const lastStep = result.steps[result.steps.length - 1];
          if (lastStep && lastStep.summary) {
            setSummary(lastStep.summary);
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

  const round = (num, places = 3) => Math.round(num * Math.pow(10, places)) / Math.pow(10, places);

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-linear-to-br from-white/95 to-white/90 backdrop-blur-lg border border-white/30 rounded-xl p-4 shadow-2xl ring-1 ring-black/5">
          <p className="font-bold text-gray-800 text-sm mb-2">
            {data.is_test_point ? 'Test Point' : `Point ${data.index}`}
          </p>
          {metadata && (
            <div className="space-y-1 text-sm">
              <p className="flex justify-between items-center">
                <span className="text-gray-700">{metadata.features[0]}:</span>
                <span className="font-semibold text-blue-600">{round(data[metadata.features[0]], 2)}</span>
              </p>
              {metadata.features[1] && (
                <p className="flex justify-between items-center">
                  <span className="text-gray-700">{metadata.features[1]}:</span>
                  <span className="font-semibold text-blue-600">{round(data[metadata.features[1]], 2)}</span>
                </p>
              )}
              <p className="flex justify-between items-center">
                <span className="text-gray-700">{metadata.target}:</span>
                <span className="font-semibold text-green-600">{round(data.target, 2)}</span>
              </p>
              {!data.is_test_point && (
                <div className="border-t border-gray-200 pt-1 mt-2">
                  <p className="flex justify-between items-center text-xs">
                    <span className="text-gray-600">Distance:</span>
                    <span className="font-medium text-purple-600">{round(data.distance, 3)}</span>
                  </p>
                </div>
              )}
              {data.is_neighbor && <p className="text-green-600 font-semibold text-xs mt-1">K-Nearest Neighbor</p>}
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  // Render interactive chart
  const KNNChart = ({ isInStep = false }) => {
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
            <span className="text-2xl">🎯</span>
            Interactive KNN Visualization
          </h2>
        )}
        <div className="bg-white rounded-xl p-2 border border-gray-200 shadow-inner h-full">
          <ResponsiveContainer width="100%" height={isInStep ? 400 : 400}>
            <ScatterChart data={chartData}>
              <CartesianGrid 
                strokeDasharray="3 3" 
                stroke="rgba(100,116,139,0.3)" 
                strokeWidth={1}
              />
              <XAxis 
                dataKey={metadata.features[0]} 
                type="number" 
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }}
                axisLine={{ stroke: 'rgba(100,116,139,0.4)', strokeWidth: 1 }}
                tickLine={{ stroke: 'rgba(100,116,139,0.4)', strokeWidth: 1 }}
                label={{ 
                  value: metadata.features[0], 
                  position: 'insideBottom', 
                  offset: -8,
                  style: { 
                    textAnchor: 'middle', 
                    fill: '#374151', 
                    fontWeight: 600,
                    fontSize: 12
                  }
                }}
              />
              <YAxis 
                dataKey={metadata.features[1] || metadata.target} 
                type="number"
                domain={['dataMin - 1', 'dataMax + 1']}
                tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }}
                axisLine={{ stroke: 'rgba(100,116,139,0.4)', strokeWidth: 1 }}
                tickLine={{ stroke: 'rgba(100,116,139,0.4)', strokeWidth: 1 }}
                label={{ 
                  value: metadata.features[1] || metadata.target, 
                  angle: -90, 
                  position: 'insideLeft',
                  style: { 
                    textAnchor: 'middle', 
                    fill: '#374151',
                    fontWeight: 600,
                    fontSize: 12
                  }
                }}
              />
              <Tooltip content={<CustomTooltip />} />
              
              {/* Regular data points */}
              <Scatter 
                name="Data Points" 
                data={chartData.filter(d => !d.is_neighbor && !d.is_test_point)}
                fill="#60a5fa"
                stroke="#3b82f6"
                strokeWidth={2}
                r={6}
              />
              
              {/* K-nearest neighbors */}
              <Scatter 
                name="K-Nearest Neighbors" 
                data={chartData.filter(d => d.is_neighbor)}
                fill="#34d399"
                stroke="#10b981"
                strokeWidth={2}
                r={8}
              />
              
              {/* Test point */}
              <Scatter 
                name="Test Point (Prediction)" 
                data={chartData.filter(d => d.is_test_point)}
                fill="#f59e0b"
                stroke="#d97706"
                strokeWidth={3}
                r={10}
                shape="diamond"
              />
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-3 text-center">
          <div className="flex justify-center items-center gap-6 text-xs text-white/90 font-medium">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full shadow-lg border border-blue-300"></div>
              <span>Data Points</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-400 rounded-full shadow-lg border border-green-300"></div>
              <span>K-Nearest Neighbors</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-400 transform rotate-45 shadow-lg border border-yellow-300"></div>
              <span>Test Point & Prediction</span>
            </div>
          </div>
          {!isInStep && (
            <p className="text-white/70 text-xs mt-2">
              Hover over points to see feature values, distances, and neighbor information
            </p>
          )}
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

        {/* Step-specific content */}
        {step.step_number === 1 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-white">
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="font-semibold mb-2 text-blue-200">Test Point:</h4>
              <div className="space-y-1">
                {Object.entries(step.test_point).map(([key, value]) => (
                  <div key={key} className="flex justify-between">
                    <span className="text-white/70">{key}:</span>
                    <span className="font-bold text-green-300">{round(value, 3)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <h4 className="font-semibold mb-2 text-blue-200">Configuration:</h4>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-white/70">K Value:</span>
                  <span className="font-bold text-emerald-300">{step.k}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Features:</span>
                  <span className="font-bold text-blue-300">{step.features.join(", ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/70">Dataset Size:</span>
                  <span className="font-bold text-white">{step.dataset_size}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {step.step_number === 2 && step.distances && (
          <div className="text-white">
            <h4 className="font-semibold mb-3 text-blue-200">Distance Calculations (First {step.distances.length}):</h4>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/20">
                    <th className="text-left p-2 text-white/70">Point</th>
                    <th className="text-left p-2 text-white/70">Features</th>
                    <th className="text-left p-2 text-white/70">Target</th>
                    <th className="text-left p-2 text-white/70">Distance</th>
                  </tr>
                </thead>
                <tbody>
                  {step.distances.map((dist, idx) => (
                    <tr key={idx} className="border-b border-white/10">
                      <td className="p-2 font-mono text-blue-300">{dist.index}</td>
                      <td className="p-2 text-white/90">
                        {Object.entries(dist.point).map(([k, v]) => `${k}: ${round(v, 2)}`).join(", ")}
                      </td>
                      <td className="p-2 font-bold text-green-300">{round(dist.target_value, 2)}</td>
                      <td className="p-2 font-bold text-yellow-300">{round(dist.distance, 3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {step.total_distances > step.distances.length && (
                <p className="text-center mt-2 text-white/70 text-sm">
                  ... and {step.total_distances - step.distances.length} more points
                </p>
              )}
            </div>
          </div>
        )}

        {step.step_number === 3 && step.k_neighbors && (
          <div className="text-white">
            <h4 className="font-semibold mb-3 text-blue-200">{step.k} Nearest Neighbors:</h4>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="grid gap-3">
                {step.k_neighbors.map((neighbor, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3 bg-emerald-600/20 rounded-lg border border-emerald-400/30">
                    <div>
                      <span className="font-semibold text-emerald-200">Point {neighbor.index}: </span>
                      <span className="text-white">
                        {Object.entries(neighbor.point).map(([k, v]) => `${k}: ${round(v, 2)}`).join(", ")}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-green-300">Target: <span className="font-bold">{round(neighbor.target_value, 2)}</span></div>
                      <div className="text-yellow-300">Distance: <span className="font-bold">{round(neighbor.distance, 3)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {step.step_number === 4 && (
          <div className="text-white">
            <h4 className="font-semibold mb-3 text-blue-200">Simple Average Calculation:</h4>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="mb-3">
                <span className="text-white/70">Values: </span>
                <span className="font-mono text-green-300">[{step.neighbor_values.map(v => round(v, 2)).join(", ")}]</span>
              </div>
              <div className="bg-black/20 rounded-lg p-3 mb-3">
                <div className="font-mono text-yellow-300 text-lg">{step.calculation}</div>
              </div>
              <div className="bg-emerald-600/20 rounded-xl p-4 border border-emerald-400/30">
                <div className="text-emerald-200 font-medium">Simple Average Prediction:</div>
                <div className="font-mono text-emerald-100 text-xl font-bold">{round(step.prediction, 3)}</div>
              </div>
            </div>
          </div>
        )}

        {step.step_number === 5 && step.weights && (
          <div className="text-white">
            <h4 className="font-semibold mb-3 text-blue-200">Weighted Average Calculation:</h4>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10">
              <div className="grid gap-2 mb-4">
                {step.weights.map((weight, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-white/5 rounded-lg">
                    <span className="text-blue-300">Point {weight.index}:</span>
                    <span className="font-mono text-white/90">
                      Weight: <span className="text-yellow-300">{round(weight.weight, 3)}</span>, 
                      Weighted: <span className="text-green-300">{round(weight.weighted_value, 3)}</span>
                    </span>
                  </div>
                ))}
              </div>
              <div className="border-t border-white/20 pt-3">
                <div className="text-white/80">Total Weight: <span className="font-bold text-yellow-300">{round(step.total_weight, 3)}</span></div>
                <div className="bg-emerald-600/20 rounded-xl p-4 mt-3 border border-emerald-400/30">
                  <div className="text-emerald-200 font-medium">Weighted Average Prediction:</div>
                  <div className="font-mono text-emerald-100 text-xl font-bold">{round(step.weighted_prediction, 3)}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step.step_number === 6 && (
          <div className="text-white">
            <h4 className="font-semibold mb-3 text-blue-200">Final Comparison:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h5 className="font-semibold mb-2 text-white/70">Simple Average</h5>
                <div className="text-2xl font-bold text-blue-300">{round(step.simple_prediction, 3)}</div>
              </div>
              <div className="bg-emerald-600/20 rounded-xl p-4 border border-emerald-400/30">
                <h5 className="font-semibold mb-2 text-emerald-200">Weighted Average (Recommended)</h5>
                <div className="text-2xl font-bold text-emerald-300">{round(step.weighted_prediction, 3)}</div>
              </div>
            </div>
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
          K-Nearest Neighbors Regression
        </h1>
        
        <p className="mt-4 text-white/85 mb-8">
          Step-by-step KNN regression with your dataset
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
            <h2 className="text-xl font-bold text-white mb-4">🎯 KNN Prediction Summary</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white">
              <div className="text-center">
                <div className="text-sm opacity-75">K Value</div>
                <div className="font-bold text-lg">{summary.k}</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-75">Simple Average</div>
                <div className="font-bold text-lg">{round(summary.simple_prediction, 3)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-75">Weighted Average</div>
                <div className="font-bold text-lg text-emerald-300">{round(summary.weighted_prediction, 3)}</div>
              </div>
              <div className="text-center">
                <div className="text-sm opacity-75">Neighbors</div>
                <div className="font-bold text-lg">{summary.nearest_neighbors}</div>
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
                {/* For steps 3, 4, 5, 6 show side-by-side layout with chart */}
                {(step.step_number >= 3) ? (
                  <div className="grid lg:grid-cols-2 gap-6 items-stretch min-h-[500px]">
                    <div className="text-left">
                      {renderStepContent(step, idx)}
                    </div>
                    <div className="lg:sticky lg:top-6 h-full">
                      <KNNChart isInStep={true} />
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
                {/* For steps 3, 4, 5, 6 show side-by-side layout with chart */}
                {(steps[currentStep].step_number >= 3) ? (
                  <div className="grid lg:grid-cols-2 gap-6 items-stretch min-h-[500px]">
                    <div className="text-left">
                      {renderStepContent(steps[currentStep], currentStep)}
                    </div>
                    <div className="lg:sticky lg:top-6 h-full">
                      <KNNChart isInStep={true} />
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

export default KNNRegressionSteps;