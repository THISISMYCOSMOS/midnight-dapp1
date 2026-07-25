// SPDX-License-Identifier: Apache-2.0

import "./browser-polyfills";
import "@midnight-ntwrk/dapp-connector-api";
import { setNetworkId } from "@midnight-ntwrk/midnight-js-network-id";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { ComparisonDemo } from "./ComparisonDemo";
import { OperatorDeployment } from "./OperatorDeployment";
import { ReviewerEnrollment } from "./ReviewerEnrollment";
import { appConfig } from "./config";
import "./styles.css";

setNetworkId(appConfig.networkId);

const RootApp =
  window.location.pathname === "/compare"
    ? ComparisonDemo
    : window.location.pathname === "/enroll"
      ? ReviewerEnrollment
      : window.location.pathname === "/deploy"
        ? OperatorDeployment
        : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootApp />
  </StrictMode>,
);
