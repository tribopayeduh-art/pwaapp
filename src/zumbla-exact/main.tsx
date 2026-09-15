import React from "react";
import { createRoot } from "react-dom/client";
import ZumblaExact from "./ZumblaExact";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><ZumblaExact /></React.StrictMode>,
);
