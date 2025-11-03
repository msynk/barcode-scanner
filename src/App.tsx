import { useState } from "react";
import BarcodeBestScanner from "./BarcodeBestScanner";
import BarcodeScanner from "./BarcodeScanner";
import "./App.css"

function App() {
  const [showBest, setShowBest] = useState(false);

  return (
    <div className="app">
      <button onClick={() => setShowBest(!showBest)}>
        {showBest ? "Best" : "Default"}
      </button>
      {(showBest) ? (
        <BarcodeBestScanner />
      ) : (
        <BarcodeScanner />
      )}
    </div>
  );
}

export default App;
