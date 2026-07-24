// SPDX-License-Identifier: Apache-2.0

import { Buffer } from "buffer";

// Midnight SDK browser bundles still use Node's Buffer global for byte/hex
// conversions. Register the browser implementation before loading the SDK.
if (!("Buffer" in globalThis)) {
  Object.assign(globalThis, { Buffer });
}
