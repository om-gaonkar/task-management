import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { queryClient } from "./lib/query-client";
import { ThemeProvider } from "./app/theme";
import { App } from "./app/App";
import "./styles.css";
ReactDOM.createRoot(document.getElementById("root")!).render(<React.StrictMode><QueryClientProvider client={queryClient}><ThemeProvider><BrowserRouter><App/></BrowserRouter></ThemeProvider></QueryClientProvider></React.StrictMode>);
