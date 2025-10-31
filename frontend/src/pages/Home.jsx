import { useRef, useState } from "react";

function Home() {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handlePick = (e) => {
    setError("");
    setUploadSuccess(false);
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
    formData.append('csvFile', file);

    setIsLoading(true);
    setError("");
    setUploadSuccess(false);

    try {
      const response = await fetch('http://localhost:8000/upload-csv', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Upload successful:', result);
      setUploadSuccess(true);
      setError("");
    } catch (err) {
      console.error('Upload failed:', err);
      setError(`Upload failed: ${err.message}`);
      setUploadSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen w-full bg-linear-to-br from-sky-700 via-blue-700 to-emerald-600 flex items-center justify-center px-6">
      <div className="text-center">
        <h1 className="text-white text-5xl md:text-7xl font-extrabold tracking-tight drop-shadow-[0_6px_20px_rgba(0,0,0,0.45)]">
          Σ ML-Tracer
        </h1>

        <p className="mt-4 text-white/85">
          Upload a CSV dataset to get started
        </p>

        <div className="mt-8 space-y-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center justify-center rounded-full bg-white/95 text-slate-900 font-semibold px-8 py-3 shadow-xl ring-1 ring-black/10 transition hover:scale-[1.02] hover:shadow-2xl active:scale-100"
          >
            Upload Dataset
          </button>

          {fileName && (
            <button
              type="button"
              onClick={uploadToBackend}
              disabled={isLoading}
              className="mx-auto inline-flex items-center justify-center rounded-full bg-emerald-600 text-white font-semibold px-8 py-3 shadow-xl ring-1 ring-black/10 transition hover:scale-[1.02] hover:shadow-2xl active:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Uploading..." : "Send to Backend"}
            </button>
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
            ✅ File uploaded successfully to backend!
          </p>
        )}
      </div>
    </main>
  );
}

export default Home;
