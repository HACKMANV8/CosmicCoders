import { useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

/* ========= Minimal Saved Datasets Store ========= */
// localStorage key that stores: [{ dataset_id, name, columns }]
const SAVED_DATASETS_KEY = "saved_datasets";

const loadSavedDatasets = () => {
  try {
    const raw = localStorage.getItem(SAVED_DATASETS_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    // de-dupe by dataset_id (latest first)
    const map = new Map();
    arr.forEach((d) => d?.dataset_id && map.set(d.dataset_id, d));
    return Array.from(map.values());
  } catch {
    return [];
  }
};

const upsertSavedDataset = ({ dataset_id, name, columns }) => {
  const list = loadSavedDatasets();
  const idx = list.findIndex((d) => d.dataset_id === dataset_id);
  const entry = { dataset_id, name, columns: Array.isArray(columns) ? columns : [] };
  if (idx >= 0) list[idx] = entry;
  else list.unshift(entry);
  localStorage.setItem(SAVED_DATASETS_KEY, JSON.stringify(list));
};
/* ================================================= */

function Home() {
  const fileRef = useRef(null);
  const navigate = useNavigate();

  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [problemType, setProblemType] = useState("");
  const [suggestedAlgorithms, setSuggestedAlgorithms] = useState([]);
  const [datasetId, setDatasetId] = useState("");
  const [algorithmComparison, setAlgorithmComparison] = useState(null);
  const [bestAlgorithm, setBestAlgorithm] = useState("");

  // Saved datasets UI
  const [showSaved, setShowSaved] = useState(false);
  const [savedDatasets, setSavedDatasets] = useState([]);

  // default list to let user choose any model when reopening a saved dataset
  const DEFAULT_ALGOS = [
    "ID3",
    "Naive Bayes",
    "Support Vector Regression",
    "KNN Regression",
    "Simple Linear Regression",
    "knn_classification"
  ];

  useEffect(() => {
    setSavedDatasets(loadSavedDatasets());
  }, []);

  const handlePick = (e) => {
    setError("");
    setUploadSuccess(false);
    setProblemType("");
    setSuggestedAlgorithms([]);
    setAlgorithmComparison(null);
    setBestAlgorithm("");

    const f = e.target.files?.[0];
    if (!f) return;

    if (!/\.csv$/i.test(f.name)) {
      setFileName("");
      setError("Please select a .csv file.");
      return;
    }
    setFileName(f.name);
  };

  const uploadToBackend = async () => {
    if (!fileRef.current?.files?.[0]) {
      setError("Please select a file first.");
      return;
    }

    const file = fileRef.current.files[0];
    const formData = new FormData();
    formData.append("file", file);
    formData.append("name", file.name.replace(/\.csv$/i, ""));
    formData.append("target", "value");

    setIsLoading(true);
    setError("");
    setUploadSuccess(false);
    setProblemType("");
    setSuggestedAlgorithms([]);
    setAlgorithmComparison(null);
    setBestAlgorithm("");

    try {
      const response = await fetch("http://localhost:8000/datasets", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const txt = await response.text();
        throw new Error(`${response.status} ${txt}`);
      }

      const result = await response.json();
      setUploadSuccess(true);
      setDatasetId(result.dataset_id);

      // Persist active dataset context used by other pages
      localStorage.setItem("datasetid", result.dataset_id);
      localStorage.setItem(
        "dataset_meta",
        JSON.stringify({ columns: result.columns, rows: result.rows })
      );

      // Save minimal dataset entry so re-open works without upload
      upsertSavedDataset({
        dataset_id: result.dataset_id,
        name: result.name || file.name.replace(/\.csv$/i, ""),
        columns: Array.isArray(result.columns) ? result.columns : [],
      });
      setSavedDatasets(loadSavedDatasets());

      // From backend (if present)
      if (result.suggested_algorithms) setSuggestedAlgorithms(result.suggested_algorithms);
      if (result.algorithm_comparison) setAlgorithmComparison(result.algorithm_comparison);
      if (result.best_algorithm) setBestAlgorithm(result.best_algorithm);

      // Quick, friendly label
      if (result.suggested_algorithms?.length > 0) {
        const first = String(result.suggested_algorithms[0]).toLowerCase();
        setProblemType(
          first === "id3" || first === "naive_bayes"
            ? "This is a classification problem."
            : "This is a regression problem."
        );
      }
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAlgorithmSelect = (algo) => {
    const key = String(algo).toLowerCase().trim().replace(/\s+/g, "_");
    localStorage.setItem("selectedAlgorithm", key);

    switch (key) {
      case "naive_bayes":
        navigate("/naiveBayes");
        break;
      case "linear_regression":
      case "simple_linear_regression":
        navigate("/simpleLinearRegression");
        break;
      case "knn_regression":
        navigate("/knnRegression");
        break;
            case "knn_classification":
      navigate("/knnClassification");
      break;
      case "support_vector_regression":
      case "svr":
        navigate("/svr");
        break;
      case "id3":
        navigate("/id3");
        break;
      default:
        alert(`No page setup for ${algo}`);
    }
  };

  /* ------- Saved Datasets ------- */
  const openSaved = () => {
    setSavedDatasets(loadSavedDatasets());
    setShowSaved(true);
  };
  const closeSaved = () => setShowSaved(false);

  const useSavedDataset = (ds) => {
    // Restore active dataset context
    localStorage.setItem("datasetid", ds.dataset_id);
    localStorage.setItem("dataset_meta", JSON.stringify({ columns: ds.columns || [] }));
    setDatasetId(ds.dataset_id);

    // Refresh the algorithm chooser so the user can pick any model again
    setSuggestedAlgorithms(DEFAULT_ALGOS);
    setProblemType("");           // neutral message; user can choose anything
    setAlgorithmComparison(null); // clear previous comparison in UI
    setBestAlgorithm("");

    setShowSaved(false);
  };

  return (
    <main className="relative min-h-screen w-full bg-gradient-to-br from-sky-700 via-blue-700 to-emerald-600 flex items-center justify-center px-6">
      {/* Top-right Saved Datasets button */}
      <div className="absolute top-5 right-5">
        <button
          type="button"
          onClick={openSaved}
          className="inline-flex items-center justify-center rounded-full bg-white/90 text-slate-900 font-semibold px-5 py-2 shadow-lg ring-1 ring-black/10 transition hover:scale-[1.02] hover:shadow-xl active:scale-100"
        >
          💾 Saved Datasets
        </button>
      </div>

      <div className="text-center">
        <h1 className="text-white text-5xl md:text-7xl font-extrabold tracking-tight drop-shadow-[0_6px_20px_rgba(0,0,0,0.45)]">
          Σ ML-Tracer
        </h1>

        <p className="mt-4 text-white/85">Upload a CSV dataset to get started</p>

        {/* Upload Section */}
        <div className="mt-8 space-y-4">
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center justify-center rounded-full bg-white/95 text-slate-900 font-semibold px-8 py-3 shadow-xl ring-1 ring-black/10 transition hover:scale-[1.02] hover:shadow-2xl active:scale-100"
            >
              Upload Dataset
            </button>
          </div>

          {fileName && (
            <div>
              <button
                type="button"
                onClick={uploadToBackend}
                disabled={isLoading}
                className="inline-flex items-center justify-center rounded-full bg-emerald-600 text-white font-semibold px-8 py-3 shadow-xl ring-1 ring-black/10 transition hover:scale-[1.02] hover:shadow-2xl active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Uploading..." : "Process data"}
              </button>
            </div>
          )}

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handlePick}
            className="hidden"
          />
        </div>

        {fileName && (
          <p className="mt-3 text-sm text-white/90">
            Selected: <span className="font-medium">{fileName}</span>
          </p>
        )}
        {error && <p className="mt-3 text-sm text-red-100">{error}</p>}
        {uploadSuccess && (
          <p className="mt-3 text-sm text-green-100">File uploaded successfully to backend!</p>
        )}

        {/* Problem Type (optional) */}
        {problemType && (
          <div
            className={`mt-4 mx-auto w-fit px-6 py-3 rounded-full shadow-lg text-white font-medium ${
              problemType.includes("regression") ? "bg-blue-600" : "bg-green-600"
            }`}
          >
            {problemType}
          </div>
        )}

        {/* Suggested Algorithms */}
        {suggestedAlgorithms.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white/90 mb-3">Suggested Algorithms:</h3>
            <div className="flex flex-wrap justify-center gap-3">
              {suggestedAlgorithms.map((algo, index) => {
                // show accuracy only if present from a fresh upload; not used for saved reopen
                const algoData = algorithmComparison?.algorithms?.find((a) => {
                  const normalizedAlgorithm = a.algorithm.toLowerCase().replace(/\s+/g, "_");
                  const normalizedSuggested = algo.toLowerCase().replace(/\s+/g, "_");
                  return normalizedAlgorithm === normalizedSuggested;
                });
                const accuracy = algoData?.metrics?.accuracy_percentage;

                return (
                  <button
                    key={index}
                    onClick={() => handleAlgorithmSelect(algo)}
                    className="px-5 py-2 rounded-full bg-white/90 text-slate-900 font-medium shadow-md hover:bg-white transition hover:scale-105 flex flex-col items-center gap-1"
                  >
                    <span>{algo.toUpperCase()}</span>
                    {accuracy !== undefined && (
                      <span className="text-xs font-bold text-emerald-600">
                        {accuracy.toFixed(1)}% accuracy
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ===== Saved Datasets Modal ===== */}
      {showSaved && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={closeSaved} />

          {/* Panel */}
          <div className="relative z-10 w-[95%] max-w-3xl bg-white/10 backdrop-blur-lg border border-white/20 rounded-2xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Saved Datasets</h2>
              <button
                onClick={closeSaved}
                className="rounded-full px-3 py-1 bg-white/20 text-white hover:bg-white/30"
              >
                ✕
              </button>
            </div>

            {savedDatasets.length ? (
              <div className="space-y-3 max-h-[65vh] overflow-auto pr-2">
                {savedDatasets.map((ds) => (
                  <div
                    key={ds.dataset_id}
                    className="flex items-center justify-between bg-white/10 border border-white/20 rounded-xl p-4"
                  >
                    <div className="text-white">
                      <div className="font-semibold">{ds.name || ds.dataset_id}</div>
                      <div className="text-xs text-white/70">
                        ID: <span className="font-mono">{ds.dataset_id}</span>
                      </div>
                      <div className="text-xs text-white/70">
                        {Array.isArray(ds.columns) ? ds.columns.length : 0} columns saved
                      </div>
                    </div>
                    <button
                      onClick={() => useSavedDataset(ds)}
                      className="px-3 py-2 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500"
                      title="Re-open this dataset and choose a model"
                    >
                      Use
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-white/80">No saved datasets yet.</div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

export default Home;
