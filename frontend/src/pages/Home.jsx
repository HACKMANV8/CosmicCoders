import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

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

  // ✅ Handle file selection
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

  // ✅ Upload dataset to backend
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
      console.log("Upload successful:", result);
      setUploadSuccess(true);
      setDatasetId(result.dataset_id);
      localStorage.setItem("datasetid", result.dataset_id);
      localStorage.setItem(
  "dataset_meta",
  JSON.stringify({ columns: result.columns, rows: result.rows })
);

      // ✅ Store algorithms from backend
      if (result.suggested_algorithms) {
        setSuggestedAlgorithms(result.suggested_algorithms);
      }

      // ✅ Store algorithm comparison results for regression
      if (result.algorithm_comparison) {
        setAlgorithmComparison(result.algorithm_comparison);
      }
      
      if (result.best_algorithm) {
        setBestAlgorithm(result.best_algorithm);
      }

      // ✅ Detect problem type
      if (result.suggested_algorithms?.length > 0) {
        const firstAlgo = result.suggested_algorithms[0].toLowerCase();
        if (firstAlgo === "id3" || firstAlgo === "naive_bayes") {
          setProblemType("This is a classification problem.");
        } else {
          setProblemType("This is a regression problem.");
        }
      }
    } catch (err) {
      setError(`Upload failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Handle algorithm click
  // ✅ Handle algorithm click (fixed braces + robust mapping)
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


  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-sky-700 via-blue-700 to-emerald-600 flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-white text-5xl md:text-7xl font-extrabold tracking-tight drop-shadow-[0_6px_20px_rgba(0,0,0,0.45)]">
          Σ ML-Tracer
        </h1>

        <p className="mt-4 text-white/85">
          Upload a CSV dataset to get started
        </p>

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
          <p className="mt-3 text-sm text-green-100">
             File uploaded successfully to backend!
          </p>
        )}

        {/* Problem Type */}
        {problemType && (
          <div
            className={`mt-4 mx-auto w-fit px-6 py-3 rounded-full shadow-lg text-white font-medium ${
              problemType.includes("regression")
                ? "bg-blue-600"
                : "bg-green-600"
            }`}
          >
            {problemType}
          </div>
        )}

        {/* Suggested Algorithms */}
        {suggestedAlgorithms.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white/90 mb-3">
              Suggested Algorithms:
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {suggestedAlgorithms.map((algo, index) => {
                // Find accuracy for this algorithm
                const algoData = algorithmComparison?.algorithms?.find(a => 
                  a.algorithm.toLowerCase().replace(/\s+/g, '_') === algo.toLowerCase()
                );
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
    </main>
  );
}

export default Home;
