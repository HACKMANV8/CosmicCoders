import React from "react";
import { BlockMath, InlineMath } from "react-katex";
import "katex/dist/katex.min.css";

const NaiveBayesSteps = () => {
  // Example dataset: Weather + Play (Yes/No)
  const data = [
    { outlook: "Sunny", temperature: "Hot", humidity: "High", windy: false, play: "No" },
    { outlook: "Sunny", temperature: "Hot", humidity: "High", windy: true, play: "No" },
    { outlook: "Overcast", temperature: "Hot", humidity: "High", windy: false, play: "Yes" },
    { outlook: "Rainy", temperature: "Mild", humidity: "High", windy: false, play: "Yes" },
    { outlook: "Rainy", temperature: "Cool", humidity: "Normal", windy: false, play: "Yes" },
    { outlook: "Rainy", temperature: "Cool", humidity: "Normal", windy: true, play: "No" },
    { outlook: "Overcast", temperature: "Cool", humidity: "Normal", windy: true, play: "Yes" },
  ];

  // Suppose we want to predict: Outlook = Sunny, Temperature = Cool, Humidity = High, Windy = true

  const total = data.length;
  const yes = data.filter((d) => d.play === "Yes").length;
  const no = total - yes;

  const pYes = yes / total;
  const pNo = no / total;

  // Likelihoods P(feature|class)
  const pOutlookSunnyYes =
    data.filter((d) => d.outlook === "Sunny" && d.play === "Yes").length / yes || 0;
  const pOutlookSunnyNo =
    data.filter((d) => d.outlook === "Sunny" && d.play === "No").length / no || 0;

  const pTempCoolYes =
    data.filter((d) => d.temperature === "Cool" && d.play === "Yes").length / yes || 0;
  const pTempCoolNo =
    data.filter((d) => d.temperature === "Cool" && d.play === "No").length / no || 0;

  const pHumidityHighYes =
    data.filter((d) => d.humidity === "High" && d.play === "Yes").length / yes || 0;
  const pHumidityHighNo =
    data.filter((d) => d.humidity === "High" && d.play === "No").length / no || 0;

  const pWindyTrueYes =
    data.filter((d) => d.windy === true && d.play === "Yes").length / yes || 0;
  const pWindyTrueNo =
    data.filter((d) => d.windy === true && d.play === "No").length / no || 0;

  // Posterior probabilities (proportional)
  const pXGivenYes =
    pOutlookSunnyYes * pTempCoolYes * pHumidityHighYes * pWindyTrueYes * pYes;
  const pXGivenNo =
    pOutlookSunnyNo * pTempCoolNo * pHumidityHighNo * pWindyTrueNo * pNo;

  const predicted = pXGivenYes > pXGivenNo ? "Yes" : "No";

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10 px-4 space-y-8">
      <h1 className="text-3xl font-bold text-blue-400 mb-6">
        Naïve Bayes Algorithm – Step-by-Step
      </h1>

      {/* Step 1: Prior probabilities */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
        <h2 className="text-xl text-green-400 font-semibold mb-3">
          Step 1: Calculate Prior Probabilities
        </h2>
        <BlockMath math={"P(\\text{Yes}) = \\frac{\\text{Yes Count}}{\\text{Total}}"} />
        <BlockMath math={"P(\\text{No}) = \\frac{\\text{No Count}}{\\text{Total}}"} />
        <p className="mt-2">
          <InlineMath
            math={`P(\\text{Yes}) = ${yes}/${total} = ${pYes.toFixed(2)}, \\quad P(\\text{No}) = ${no}/${total} = ${pNo.toFixed(2)}`}
          />
        </p>
      </div>

      {/* Step 2: Conditional probabilities */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
        <h2 className="text-xl text-yellow-400 font-semibold mb-3">
          Step 2: Compute Conditional Probabilities
        </h2>
        <BlockMath math={"P(X|C_k) = \\prod_i P(x_i|C_k)"} />
        <p className="mt-3">
          <InlineMath math={`P(\\text{Outlook=Sunny|Yes}) = ${pOutlookSunnyYes.toFixed(2)}`} />
          <br />
          <InlineMath math={`P(\\text{Temperature=Cool|Yes}) = ${pTempCoolYes.toFixed(2)}`} />
          <br />
          <InlineMath math={`P(\\text{Humidity=High|Yes}) = ${pHumidityHighYes.toFixed(2)}`} />
          <br />
          <InlineMath math={`P(\\text{Windy=True|Yes}) = ${pWindyTrueYes.toFixed(2)}`} />
        </p>
        <hr className="my-3 border-gray-700" />
        <p>
          <InlineMath math={`P(\\text{Outlook=Sunny|No}) = ${pOutlookSunnyNo.toFixed(2)}`} />
          <br />
          <InlineMath math={`P(\\text{Temperature=Cool|No}) = ${pTempCoolNo.toFixed(2)}`} />
          <br />
          <InlineMath math={`P(\\text{Humidity=High|No}) = ${pHumidityHighNo.toFixed(2)}`} />
          <br />
          <InlineMath math={`P(\\text{Windy=True|No}) = ${pWindyTrueNo.toFixed(2)}`} />
        </p>
      </div>

      {/* Step 3: Posterior Calculation */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4">
        <h2 className="text-xl text-pink-400 font-semibold mb-3">
          Step 3: Compute Posterior Probabilities
        </h2>
        <BlockMath math={"P(C_k|X) \\propto P(C_k) \\prod_i P(x_i|C_k)"} />
        <p className="mt-2">
          <InlineMath
            math={`P(X|\\text{Yes}) = (${pOutlookSunnyYes.toFixed(
              2
            )})(${pTempCoolYes.toFixed(2)})(${pHumidityHighYes.toFixed(
              2
            )})(${pWindyTrueYes.toFixed(2)})(${pYes.toFixed(2)}) = ${pXGivenYes.toExponential(
              3
            )}`}
          />
        </p>
        <p className="mt-2">
          <InlineMath
            math={`P(X|\\text{No}) = (${pOutlookSunnyNo.toFixed(
              2
            )})(${pTempCoolNo.toFixed(2)})(${pHumidityHighNo.toFixed(
              2
            )})(${pWindyTrueNo.toFixed(2)})(${pNo.toFixed(2)}) = ${pXGivenNo.toExponential(
              3
            )}`}
          />
        </p>
      </div>

      {/* Step 4: Classification */}
      <div className="bg-gray-800 p-6 rounded-2xl shadow-lg w-full md:w-3/4 border border-blue-400">
        <h2 className="text-xl text-blue-400 font-semibold mb-3">
          Step 4: Classify the Sample
        </h2>
        <p className="mb-2">
          <InlineMath math={`P(X|\\text{Yes}) = ${pXGivenYes.toExponential(3)}`} />
          <br />
          <InlineMath math={`P(X|\\text{No}) = ${pXGivenNo.toExponential(3)}`} />
        </p>
        <h3 className="text-lg mt-3">
          ✅ Predicted Class:{" "}
          <span className="text-green-400 font-bold">{predicted}</span>
        </h3>
      </div>
    </div>
  );
};

export default NaiveBayesSteps;
