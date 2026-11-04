import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/source-sans-pro/400.css";
import "@fontsource/source-sans-pro/600.css";
import "@fontsource/source-sans-pro/700.css";
import "./styles.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AssessmentApp } from "./ui/AssessmentApp";

const root = document.querySelector("#root");
if (!root) throw new Error("Missing #root");

createRoot(root).render(
  <StrictMode>
    <TooltipProvider>
      <AssessmentApp />
    </TooltipProvider>
  </StrictMode>,
);
