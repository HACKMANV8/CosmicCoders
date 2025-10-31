import React, { useEffect, useState } from "react";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

const NaiveBayes = () => {
  const [dataset, setDataset] = useState(null);
  const [calculations, setCalculations] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCalculation = async () => {
      try {
        const dataset_id = localStorage.getItem("datasetid");
        const algo = "naive_bayes"; // fixed for this page

        if (!dataset_id) {
          setError("Dataset ID not found. Please upload a dataset first.");
          setLoading(false);
          return;
        }

        // ✅ POST to /calculation to perform Naive Bayes and get full results
        const response = await fetch("http://localhost:8000/calculation", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataset_id: dataset_id,
            algorithm: algo,
            params: {
              target: "Play",
              example: {
                Outlook: "Sunny",
                Temp: "Cool",
                Humidity: "High",
                Wind: true,
              },
            },
          }),
        });

        if (!response.ok) throw new Error("Failed to fetch calculations");

        const data = await response.json();

        // Example backend response:
        // {
        //   dataset: [...],
        //   steps: { priors: {...}, likelihoods: {...}, posteriors: {...}, predicted: "Yes" }
        // }

        setDataset(data.dataset || []);
        setCalculations(data.steps);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCalculation();
  }, []);

  // 🌀 Loading and Error UI
  if (loading)
    return <div className="text-white text-center mt-20">Loading Naive Bayes...</div>;
  if (error)
    return <div className="text-red-400 text-center mt-20">{error}</div>;

  if (!calculations)
    return <div className="text-white text-center mt-20">No calculation results available.</div>;

  const { priors, likelihoods, posteriors, predicted } = calculations;

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4 space-y-8">
      <h1 className="text-3xl font-bold text-blue-400 mb-6">
        Naïve Bayes Algorithm – Step-by-Step
      </h1>

      {/* ✅ Step 1: Prior Probabilities */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
        <h2 className="text-xl text-green-400 font-semibold mb-3">
          Step 1: Prior Probabilities
        </h2>
        {priors &&
          Object.keys(priors).map((cls) => (
            <p key={cls}>
              <InlineMath math={`P(${cls}) = ${priors[cls].toFixed(2)}`} />
            </p>
          ))}
      </div>

      {/* ✅ Step 2: Conditional Probabilities */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
        <h2 className="text-xl text-yellow-400 font-semibold mb-3">
          Step 2: Conditional Probabilities
        </h2>
        <BlockMath math={"P(X|C_k) = \\prod_i P(x_i|C_k)"} />
        {likelihoods &&
          Object.entries(likelihoods).map(([cls, probs]) => (
            <div key={cls} className="mt-3">
              <h3 className="font-semibold text-blue-300">Class: {cls}</h3>
              {Object.entries(probs).map(([feature, value]) => (
                <p key={feature}>
                  <InlineMath math={`P(${feature}|${cls}) = ${value.toFixed(2)}`} />
                </p>
              ))}
            </div>
          ))}
      </div>

      {/* ✅ Step 3: Posterior Probabilities */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
        <h2 className="text-xl text-pink-400 font-semibold mb-3">
          Step 3: Posterior Probabilities
        </h2>
        {posteriors &&
          Object.entries(posteriors).map(([cls, value]) => (
            <p key={cls}>
              <InlineMath math={`P(${cls}|X) \\propto ${value.toExponential(3)}`} />
            </p>
          ))}
      </div>

      {/* ✅ Step 4: Final Prediction */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4 border border-blue-400">
        <h2 className="text-xl text-blue-400 font-semibold mb-3">
          Step 4: Classification
        </h2>
        <h3 className="text-lg mt-3">
          ✅ Predicted Class:{" "}
          <span className="text-green-400 font-bold">{predicted}</span>
        </h3>
      </div>
    </div>
  );
};

export default NaiveBayes;
