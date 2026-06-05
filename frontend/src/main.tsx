import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import { ModelDownload } from "./components/ModelDownload";

function Root() {
  const [ready, setReady] = useState(false);
  return ready ? <App /> : <ModelDownload onReady={() => setReady(true)} />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
