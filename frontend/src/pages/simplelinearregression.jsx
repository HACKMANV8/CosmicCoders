import React from "react";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

const LinearRegressionSteps = () => {
  // Example data points
  const x = [1, 2, 3, 4, 5];
  const y = [2, 3, 5, 4, 6];
  const n = x.length;

  // Step 1: Compute means
  const mean = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;
  const meanX = mean(x);
  const meanY = mean(y);

  // Step 2: Compute slope (m)
  const numerator = x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0);
  const denominator = x.reduce((sum, xi) => sum + (xi - meanX) ** 2, 0);
  const m = numerator / denominator;

  // Step 3: Compute intercept (c)
  const c = meanY - m * meanX;

  // Step 4: Predict for example x = 6
  const xPred = 6;
  const yPred = m * xPred + c;

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
        <BlockMath math={`\\bar{x} = \\frac{\\sum x_i}{n}, \\quad \\bar{y} = \\frac{\\sum y_i}{n}`} />
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
