import { useState } from "react";
import BarcodeBestScanner from "./BarcodeBestScanner";
import BarcodeScanner from "./BarcodeScanner";

function App() {
  const [showBest, setShowBest] = useState(false);
  return (
    <div style={{ padding: 10 }}>
      <button onClick={() => setShowBest(!showBest)}>
        {showBest ? "Default" : "Best"}
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
