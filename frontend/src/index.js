import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min";
import "handsontable/dist/handsontable.full.css";
import { registerAllModules } from "handsontable/registry";
import App from "./App";
import reportWebVitals from "./reportWebVitals";

// ✅ Register all Handsontable modules globally
registerAllModules();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

reportWebVitals();