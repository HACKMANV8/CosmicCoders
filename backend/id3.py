# id3.py
from __future__ import annotations
from typing import Dict, Any, List, Tuple
import math
import pandas as pd
from pandas.api.types import is_bool_dtype, is_object_dtype


# ---------- math helpers ----------

def _entropy_from_counts(counts: Dict[str, int]) -> float:
    """H = - sum p log2 p ; treat 0*log(0)=0."""
    n = sum(counts.values())
    if n <= 0:
        return 0.0
    h = 0.0
    for c in counts.values():
        if c <= 0:
            continue
        p = c / n
        h -= p * math.log2(p)
    return float(h)


def _series_class_counts(s: pd.Series) -> Dict[str, int]:
    """Return class->count mapping (string keys) for a target slice."""
    vc = s.dropna().astype("string").value_counts()
    return {str(k): int(v) for k, v in vc.items()}


def _value_label(v: Any) -> str:
    """String label for a feature value (including NaN)."""
    if pd.isna(v):
        return "NaN"
    return str(v)


# ---------- core ID3 (categorical features version for root) ----------

def gain_for_categorical(
    df: pd.DataFrame,
    target: str,
    feature: str,
) -> Dict[str, Any]:
    """
    Compute detailed information gain for a *categorical* feature.
    Returns the exact pieces needed to render step-by-step like the image.
    """
    S = df
    N = len(S)
    base_counts = _series_class_counts(S[target])
    base_entropy = _entropy_from_counts(base_counts)

    parts: List[Dict[str, Any]] = []
    weighted_sum = 0.0

    for v, subset in S.groupby(feature, dropna=False):
        Sv = subset
        n_v = len(Sv)
        if n_v == 0:
            continue

        counts_v = _series_class_counts(Sv[target])
        h_v = _entropy_from_counts(counts_v)
        weight = (n_v / N) if N else 0.0
        weighted_sum += weight * h_v

        # build “term” decomposition p(c) log2 p(c) for rendering
        # (the UI can reconstruct, but having it here helps)
        p_terms: List[Tuple[str, float]] = []
        for cls, cnt in counts_v.items():
            p = cnt / n_v if n_v else 0.0
            if p > 0:
                p_terms.append((cls, p))

        parts.append({
            "value": _value_label(v),
            "size": int(n_v),
            "weight": float(weight),
            "class_counts": counts_v,            # e.g. {"Yes": 3, "No": 2}
            "p_terms": [{"class": c, "p": float(p)} for (c, p) in p_terms],
            "entropy": float(h_v),
        })

    gain = base_entropy - weighted_sum

    return {
        "feature": feature,
        "kind": "categorical",
        "total": int(N),
        "base_counts": base_counts,              # for S
        "base_entropy": float(base_entropy),     # H(S)
        "parts": parts,                          # per value v
        "weighted_sum": float(weighted_sum),     # Σ (|S_v|/|S|) H(S_v)
        "gain": float(gain),                     # Gain(S, A)
    }


def compute_id3_root_steps(
    df: pd.DataFrame,
    target: str,
    features: List[str] | None = None,
) -> Dict[str, Any]:
    """
    Build a steps payload for the *root*:
      step 1: H(S)
      step 2..F+1: For each feature, full breakdown (entropy per value + weighted sum + gain)
      last step: ranked summary with the chosen feature

    Returns: {"steps": [...], "feature_summaries": [...], "best": {"feature":..., "gain": ...}}
    """
    if target not in df.columns:
        raise ValueError(f"Target '{target}' not found in columns.")

    # candidate feature list
    if features is None:
        candidates = [c for c in df.columns if c != target]
    else:
        candidates = [c for c in features if c in df.columns and c != target]

    # Step 1: H(S)
    base_counts = _series_class_counts(df[target])
    total = int(len(df))
    Hs = _entropy_from_counts(base_counts)
    steps: List[Dict[str, Any]] = [{
        "step_id": 1,
        "node_id": "root",
        "order": 1,
        "type": "entropy",
        "formula_id": "entropy_multiclass",
        "vars": {"counts": base_counts, "total": total},
        "result": {"entropy": float(Hs)},
    }]

    # Per-feature breakdown (categorical only in this version)
    feature_summaries: List[Dict[str, Any]] = []
    order = 2
    for f in candidates:
        if not (is_bool_dtype(df[f]) or is_object_dtype(df[f])):
            # You can extend here with numeric-threshold gain later
            continue

        details = gain_for_categorical(df, target, f)
        feature_summaries.append({
            "feature": f,
            "gain": details["gain"],
            "kind": "categorical",
        })

        # One detailed step per feature (like the screenshot)
        steps.append({
            "step_id": order,
            "node_id": "root",
            "order": order,
            "type": "gain",
            "formula_id": "gain_feature_breakdown",
            "context": {
                "feature": f,
                "values": [p["value"] for p in details["parts"]],
            },
            "vars": {
                "base_entropy": details["base_entropy"],    # H(S)
                "total": details["total"],                  # |S|
                "parts": [
                    {
                        "value": p["value"],
                        "size": p["size"],                  # |S_v|
                        "weight": p["weight"],              # |S_v| / |S|
                        "class_counts": p["class_counts"],  # {Yes:3, No:2}
                        "p_terms": p["p_terms"],            # [{class:'Yes', p:0.6}, ...]
                        "entropy": p["entropy"],            # H(S_v)
                    }
                    for p in details["parts"]
                ],
            },
            "result": {
                "weighted_sum": details["weighted_sum"],    # Σ (|S_v|/|S|) H(S_v)
                "gain": details["gain"],                    # Gain(S, f)
            },
        })
        order += 1

    # Ranked summary + chosen root
    best_feature = None
    best_gain = -1.0
    ranked = sorted(feature_summaries, key=lambda x: x["gain"], reverse=True)
    if ranked:
        best_feature = ranked[0]["feature"]
        best_gain = ranked[0]["gain"]

    steps.append({
        "step_id": order,
        "node_id": "root",
        "order": order,
        "type": "split",
        "formula_id": "split_choose_feature",
        "context": {
            "chosen_feature": best_feature,
            "candidates": [[r["feature"], r["gain"]] for r in ranked],
        },
        "result": {"best_feature": best_feature, "best_gain": best_gain},
    })

    return {
        "steps": steps,
        "feature_summaries": ranked,
        "best": {"feature": best_feature, "gain": best_gain},
    }
