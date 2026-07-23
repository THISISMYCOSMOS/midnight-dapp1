// SPDX-License-Identifier: Apache-2.0

import "@midnight-ntwrk/dapp-connector-api";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ComparisonDemo } from "./ComparisonDemo";
import { consumeImportedBrowserSecret } from "./browser-secret";
import { appConfig } from "./config";
import "./styles.css";

setNetworkId(appConfig.networkId);
consumeImportedBrowserSecret(appConfig.contractAddress ?? "unconfigured");

const RootApp = window.location.pathname === "/compare" ? ComparisonDemo : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
