// src/components/Id3AutoRunner.jsx
import React, { useEffect, useMemo, useState } from "react";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const Card = ({ children }) => (
  <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow">
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
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

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
      setErr("");
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
        setResult(j);
      } catch (e) {
        setErr(String(e.message || e));
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [datasetId, autoTarget, features]);

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

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-indigo-900 to-emerald-900 text-white p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-end justify-between gap-4">
          <h1 className="text-2xl font-extrabold">ID3 — Step-by-Step (Auto)</h1>
          <div className="text-sm text-white/80">
            dataset_id:{" "}
            <span className="font-mono">{datasetId || "— (missing)"}</span>
          </div>
        </div>

        <Card>
          <div className="text-sm">
            <div>
              Target (auto):{" "}
              <span className="font-mono text-emerald-300">
                {autoTarget || "—"}
              </span>
            </div>
            <div className="mt-1">
              Features:{" "}
              <span className="font-mono">
                {features.length ? features.join(", ") : "—"}
              </span>
            </div>
            {loading && <div className="mt-2">Running ID3…</div>}
            {err && <div className="mt-2 text-red-300">{err}</div>}
          </div>
        </Card>

        {result && (
          <>
            <Card>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold">Root split</div>
                  <div className="mt-1">
                    Best feature:&nbsp;
                    <span className="font-mono text-emerald-300">
                      {result.best?.feature ?? "—"}
                    </span>
                    {result.best?.gain != null && (
                      <>
                        &nbsp; (gain{" "}
                        <span className="font-mono">
                          {round(result.best.gain)}
                        </span>
                        )
                      </>
                    )}
                  </div>
                </div>
                <div className="text-sm">
                  run_id:&nbsp;
                  <span className="font-mono text-white/80">
                    {result.run_id}
                  </span>
                </div>
              </div>

              {Array.isArray(result.feature_summaries) &&
                result.feature_summaries.length > 0 && (
                  <div className="mt-4">
                    <div className="text-sm font-semibold mb-2">
                      Feature gains at root
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-white/80">
                            <th className="px-2 py-1">Feature</th>
                            <th className="px-2 py-1">Gain</th>
                          </tr>
                        </thead>
                        <tbody className="text-white/90">
                          {result.feature_summaries.map((r, i) => (
                            <tr key={i} className="border-t border-white/10">
                              <td className="px-2 py-1 font-mono">{r.feature}</td>
                              <td className="px-2 py-1 font-mono">
                                {round(r.gain)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
            </Card>

            <div className="grid gap-4">
              {(result.steps || []).map((s) => (
                <div key={s.step_id ?? `${s.node_id}-${s.order}`}>
                  <StepRenderer step={s} />
                </div>
              ))}
            </div>
          </>
        )}
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
      <div className="mb-2 font-semibold">Entropy at root</div>
      <BlockMath math={"H(S) = -\\sum_c p(c)\\log_2 p(c)"} />
      <div className="mt-2 text-sm">
        {Object.entries(counts).map(([cls, n]) => {
          const p = total ? (n / total).toFixed(4) : "—";
          return (
            <div key={cls} className="font-mono">
              {cls}: {n} {total ? `(p=${p})` : ""}
            </div>
          );
        })}
      </div>
      <div className="mt-2 text-emerald-200">
        H(S) = <span className="font-mono">{round(Hs)}</span>
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
      <div className="mb-2 font-semibold">
        Information Gain for <span className="font-mono">{feature}</span>
      </div>
      <BlockMath math={"\\text{Gain}(S, A) = H(S) - \\sum_v \\frac{|S_v|}{|S|} H(S_v)"} />
      <div className="mt-2 text-sm text-white/80">
        Base: H(S) = <span className="font-mono">{round(base)}</span> · N=
        <span className="font-mono">{total}</span>
      </div>

      <div className="mt-3 space-y-2">
        {parts.map((p, idx) => (
          <div key={idx} className="rounded-lg border border-white/10 bg-white/5 p-3">
            <div className="text-sm">
              <span className="font-semibold">Value</span>:{" "}
              <span className="font-mono">{String(p.value)}</span> · |Sᵥ|=
              <span className="font-mono">{p.size}</span> · weight=
              <span className="font-mono">{round(p.weight, 4)}</span>
            </div>
            <div className="mt-1 text-sm">
              Class counts:&nbsp;
              <span className="font-mono">
                {Object.entries(p.class_counts)
                  .map(([k, v]) => `${k}:${v}`)
                  .join(", ")}
              </span>
            </div>
            <div className="mt-1">
              <InlineMath math={"H(S_v) = -\\sum_c p(c)\\log_2 p(c)"} />
              <div className="mt-1 text-xs text-white/80">
                p(c):{" "}
                <span className="font-mono">
                  {Array.isArray(p.p_terms)
                    ? p.p_terms.map((t) => `${t.class}=${round(t.p, 4)}`).join(", ")
                    : "—"}
                </span>
              </div>
              <div className="mt-1">
                H(Sᵥ) = <span className="font-mono">{round(p.entropy)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 text-sm">
        Σ weight·H(Sᵥ) ={" "}
        <span className="font-mono">{round(weightedSum)}</span>
      </div>
      <div className="mt-1 text-emerald-200">
        Gain(S, {feature}) ={" "}
        <span className="font-mono">{round(gain)}</span>
      </div>
    </Card>
  );
}

function SplitChooseFeature({ step }) {
  const chosen = step?.context?.chosen_feature;
  const cands = step?.context?.candidates || [];
  return (
    <Card>
      <div className="mb-2 font-semibold">Split choice</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-white/80">
              <th className="px-2 py-1">Feature</th>
              <th className="px-2 py-1">Gain</th>
            </tr>
          </thead>
          <tbody className="text-white/90">
            {cands.map(([f, g], i) => (
              <tr key={i} className="border-t border-white/10">
                <td className="px-2 py-1 font-mono">
                  {f} {f === chosen && <span className="text-emerald-300">★</span>}
                </td>
                <td className="px-2 py-1 font-mono">{round(g)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chosen && (
        <div className="mt-2 text-emerald-200">
          Chosen root: <span className="font-mono">{chosen}</span>
        </div>
      )}
    </Card>
  );
}

function GenericStep({ step }) {
  return (
    <Card>
      <div className="font-semibold">
        {step.type} <span className="text-white/60">({step.formula_id})</span>
      </div>
      {step.vars && (
        <pre className="mt-2 text-xs whitespace-pre-wrap break-words">
          {JSON.stringify(step.vars, null, 2)}
        </pre>
      )}
      {step.result && (
        <div className="mt-2 font-mono text-emerald-200">
          {JSON.stringify(step.result)}
        </div>
      )}
    </Card>
  );
}
