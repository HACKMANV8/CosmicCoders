import React, { useEffect, useState } from "react";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

const NaiveBayes = () => {
  const [datasetPreview, setDatasetPreview] = useState([]);
  const [priors, setPriors] = useState(null);
  const [likelihoods, setLikelihoods] = useState(null);
  const [posteriors, setPosteriors] = useState(null);
  const [predicted, setPredicted] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Helpers to format numbers safely
  const toFixedSafe = (v, n = 2) =>
    typeof v === "number" && isFinite(v) ? v.toFixed(n) : String(v);

  const toExpSafe = (v, n = 3) =>
    typeof v === "number" && isFinite(v) ? v.toExponential(n) : String(v);

  useEffect(() => {
    const fetchCalculation = async () => {
      try {
        const dataset_id = localStorage.getItem("datasetid");
        if (!dataset_id) {
          setError("Dataset ID not found. Please upload a dataset first.");
          setLoading(false);
          return;
        }

        const res = await fetch("http://localhost:8000/naivebayes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dataset_id,
            algorithm: "naive_bayes",
            params: {
              target: "Play",
              example: {
                Outlook: "Sunny",
                Temp: "Cool",
                Humidity: "High",
                Wind: "True", // keep values as strings; backend stringifies features
              },
            },
          }),
        });

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Request failed: ${res.status}`);
        }

        const data = await res.json();

        // Save dataset preview if present
        const preview =
          data.dataset_preview || data.dataset || [];
        setDatasetPreview(Array.isArray(preview) ? preview : []);

        // Backend may return:
        // 1) steps as object: { priors, likelihoods, posteriors, predicted, confidence }
        // 2) steps as array with those pieces inside items.
        const { steps } = data || {};

        if (steps && !Array.isArray(steps)) {
          // Object shape
          setPriors(steps.priors || null);
          setLikelihoods(steps.likelihoods || null);
          setPosteriors(steps.posteriors || null);
          setPredicted(steps.predicted ?? null);
          setConfidence(steps.confidence ?? null);
        } else if (Array.isArray(steps)) {
          // Array shape — find the relevant steps
          const priorsStep = steps.find((s) => s.priors);
          const likStep = steps.find((s) => s.likelihoods);
          const postUnnorm = steps.find((s) => s.posteriors_unnormalized);
          const postNorm = steps.find((s) => s.posteriors);
          const predStep = steps.find((s) => s.predicted);

          setPriors(priorsStep?.priors || null);
          setLikelihoods(likStep?.likelihoods || null);
          setPosteriors((postNorm?.posteriors) ?? null);

          // If normalized not provided, show unnormalized
          if (!postNorm?.posteriors && postUnnorm?.posteriors_unnormalized) {
            setPosteriors(postUnnorm.posteriors_unnormalized);
          }

          if (predStep) {
            setPredicted(predStep.predicted ?? null);
            setConfidence(predStep.confidence ?? null);
          } else if (data.result) {
            setPredicted(data.result.predicted ?? null);
            setConfidence(data.result.confidence ?? null);
          }
        } else {
          // Minimal fallback
          setPriors(data.priors || null);
          setLikelihoods(data.likelihoods || null);
          setPosteriors(data.posteriors || null);
          setPredicted(data.predicted ?? null);
          setConfidence(data.confidence ?? null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };

    fetchCalculation();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        Loading Naive Bayes...
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-red-400 flex items-center justify-center">
        {error}
      </div>
    );
  }

  const hasResults = priors || likelihoods || posteriors || predicted;

  if (!hasResults) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        No calculation results available.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4 space-y-8">
      <h1 className="text-3xl font-bold text-blue-400 mb-6">
        Naïve Bayes Algorithm – Step-by-Step
      </h1>

      {/* Optional: Dataset Preview */}
      {datasetPreview.length > 0 && (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
          <h2 className="text-lg font-semibold text-white mb-3">Dataset Preview</h2>
          <div className="overflow-auto border border-white/10 rounded-xl">
            <table className="min-w-full text-sm">
              <thead className="bg-white/5">
                <tr>
                  {Object.keys(datasetPreview[0]).map((col) => (
                    <th key={col} className="px-3 py-2 text-left text-white/80">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {datasetPreview.map((row, i) => (
                  <tr key={i} className="odd:bg-white/0 even:bg-white/[0.03]">
                    {Object.keys(datasetPreview[0]).map((col) => (
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
      )}

      {/* Step 1: Priors */}
      {priors && (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
          <h2 className="text-xl text-green-400 font-semibold mb-3">
            Step 1: Prior Probabilities
          </h2>
          {Object.keys(priors).map((cls) => (
            <p key={cls}>
              <InlineMath math={`P(${cls}) = ${toFixedSafe(priors[cls], 4)}`} />
            </p>
          ))}
        </div>
      )}

      {/* Step 2: Conditional Probabilities */}
      {likelihoods && (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
          <h2 className="text-xl text-yellow-400 font-semibold mb-3">
            Step 2: Conditional Probabilities
          </h2>
          <BlockMath math={"P(X\\mid C_k) = \\prod_i P(x_i\\mid C_k)"} />
          {Object.entries(likelihoods).map(([cls, probs]) => (
            <div key={cls} className="mt-3">
              <h3 className="font-semibold text-blue-300">Class: {cls}</h3>
              {Object.entries(probs).map(([feature, value]) => (
                <p key={feature}>
                  <InlineMath
                    math={`P(${feature}\\mid${cls}) = ${toFixedSafe(value, 4)}`}
                  />
                </p>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* Step 3: Posterior Probabilities */}
      {posteriors && (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
          <h2 className="text-xl text-pink-400 font-semibold mb-3">
            Step 3: Posterior Probabilities
          </h2>
          {Object.entries(posteriors).map(([cls, value]) => (
            <p key={cls}>
              {/* show normalized as P(C|X) if it looks like normalized; else use ∝ */}
              <InlineMath
                math={
                  value <= 1 && value >= 0
                    ? `P(${cls}\\mid X) = ${toFixedSafe(value, 6)}`
                    : `P(${cls}\\mid X) \\propto ${toExpSafe(value, 3)}`
                }
              />
            </p>
          ))}
        </div>
      )}

      {/* Step 4: Final Prediction */}
      {(predicted !== null || confidence !== null) && (
        <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4 border border-blue-400">
          <h2 className="text-xl text-blue-400 font-semibold mb-3">
            Step 4: Classification
          </h2>
          {predicted !== null && (
            <h3 className="text-lg mt-3">
              ✅ Predicted Class:{" "}
              <span className="text-green-400 font-bold">{String(predicted)}</span>
            </h3>
          )}
          {typeof confidence === "number" && isFinite(confidence) && (
            <p className="text-white/80 mt-1">
              Confidence: <span className="font-semibold">{toFixedSafe(confidence, 6)}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default NaiveBayes;
