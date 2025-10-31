import React, { useEffect, useState } from "react";
import "katex/dist/katex.min.css";
import { InlineMath } from "react-katex";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const Card = ({ title, children }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-5 shadow space-y-3">
    {title && <div className="text-lg font-semibold">{title}</div>}
    {children}
  </div>
);

const round = (x, d = 6) =>
  typeof x === "number" ? Number.parseFloat(x.toFixed(d)) : x;

export default function NaiveBayesPage() {
  const [datasetId, setDatasetId] = useState("");
  const [target, setTarget] = useState("");
  const [columns, setColumns] = useState([]);
  const [example, setExample] = useState({});
  const [result, setResult] = useState({ steps: [] });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // Load dataset info
  useEffect(() => {
    const id = localStorage.getItem("datasetid") || "";
    setDatasetId(id);

    const metaRaw = localStorage.getItem("dataset_meta");
    if (metaRaw) {
      try {
        const meta = JSON.parse(metaRaw);
        setColumns(meta.columns || []);
      } catch(e) {
       console.log(e)
      }
    }
  }, []);

  // Set default target
  useEffect(() => {
    if (columns.length > 0) {
      setTarget(columns[columns.length - 1]);
      const initialExample = {};
      columns.slice(0, -1).forEach((col) => (initialExample[col] = ""));
      setExample(initialExample);
    }
  }, [columns]);

  const handleExampleChange = (col, value) => {
    setExample((prev) => ({ ...prev, [col]: value }));
  };

  async function runNB() {
    try {
      setErr("");
      setLoading(true);
      setResult({ steps: [] });

      const body = {
        dataset_id: datasetId,
        algorithm: "naive_bayes",
        params: { target, example },
      };

      const res = await fetch(`${API_BASE}/naivebayes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-emerald-900 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-extrabold">
            Naïve Bayes — Full Step-by-Step Calculation
          </h1>
          <button
            onClick={runNB}
            disabled={loading}
            className="px-4 py-2 bg-emerald-600 rounded hover:bg-emerald-700 disabled:opacity-50"
          >
            {loading ? "Calculating..." : "Run Naive Bayes"}
          </button>
        </div>

        {err && (
          <Card>
            <div className="text-red-400">{err}</div>
          </Card>
        )}

        {columns.length > 0 && (
          <Card title="Enter Feature Values">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {columns
                .filter((col) => col !== target)
                .map((col) => (
                  <div key={col} className="space-y-1">
                    <label className="text-sm text-white/70">{col}</label>
                    <input
                      type="text"
                      value={example[col] || ""}
                      onChange={(e) =>
                        handleExampleChange(col, e.target.value)
                      }
                      className="w-full rounded bg-white/10 p-2 text-white border border-white/20 focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                ))}
            </div>
            <p className="text-white/60 text-sm mt-3">
              Target column: <span className="font-semibold">{target}</span>
            </p>
          </Card>
        )}

        {/* --- Results Display --- */}
        {result?.steps?.length > 0 && (
          <>
            {result?.dataset_preview && (
              <Card title="Dataset Preview">
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="text-white/70">
                      <tr>
                        {Object.keys(result.dataset_preview[0] || {}).map(
                          (col) => (
                            <th key={col} className="px-2 py-1 text-left">
                              {col}
                            </th>
                          )
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {result.dataset_preview.map((row, i) => (
                        <tr key={i} className="border-t border-white/10">
                          {Object.keys(row).map((col) => (
                            <td key={col} className="px-2 py-1">
                              {String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {result.steps.map((step, idx) => (
              <Card key={idx} title={`Step ${step.step}: ${step.title}`}>
                {step.step === 1 && step.result?.priors && (
                  <div className="space-y-2">
                    {Object.entries(step.result.priors).map(([cls, p]) => (
                      <div key={cls}>
                        <InlineMath
                          math={`P(${cls}) = \\frac{count(${cls})}{N} = ${round(p)}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {step.step === 2 && step.result?.details && (
                  <div className="space-y-3">
                    {Object.entries(step.result.details).map(([cls, features]) => (
                      <div key={cls}>
                        <div className="font-semibold text-emerald-300">
                          Class: {cls}
                        </div>
                        {Object.entries(features).map(([feature, values]) => (
                          <div key={feature} className="pl-4">
                            <div className="text-white/70">{feature}</div>
                            {Object.entries(values).map(([val, prob]) => (
                              <div key={val} className="pl-4">
                                <InlineMath math={`P(${feature}=${val}|${cls})=${round(prob,4)}`} />
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {step.step === 3 && step.result?.per_class && (
                  <div className="space-y-2">
                    {Object.entries(step.result.per_class).map(([cls, v]) => (
                      <div key={cls}>
                        <InlineMath
                          math={`P(${cls}) × ${v.multipliers
                            .map(
                              (m) => `P(${m.feature}=${m.value}|${cls})=${m.p}`
                            )
                            .join(" × ")} = ${round(v.unnormalized, 8)}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {step.step === 4 && step.result?.posteriors && (
                  <div className="space-y-2">
                    <InlineMath
                      math={`Evidence = ${round(step.vars?.evidence || 0, 8)}`}
                    />
                    {Object.entries(step.result.posteriors).map(([cls, val]) => (
                      <div key={cls}>
                        <InlineMath math={`P(${cls}|X) = ${round(val, 8)}`} />
                      </div>
                    ))}
                  </div>
                )}

                {step.step === 5 && step.result?.predicted && (
                  <div className="space-y-2 text-lg">
                    <div>
                      <span className="text-emerald-300 font-mono">
                        Predicted: {step.result.predicted}
                      </span>
                    </div>
                    <div>
                      Confidence:{" "}
                      <span className="font-mono">
                        {round(step.result.confidence, 6)}
                      </span>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
