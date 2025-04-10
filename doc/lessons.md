# Lessons Learned: Debugging MCP Server `tools/list`

This document summarizes the key lessons learned while debugging the `tools/list` method for the Etherscan MCP server, specifically addressing the "Invalid literal value, expected 'object'" error from the MCP Inspector.

## 1. MCP Inspector Schema Expectation

- **Problem:** The MCP Inspector validation expects the `inputSchema` field for each tool definition to be a JSON Schema object with a top-level `type` property set directly to `"object"`.
- **Observation:** Errors like `"code": "invalid_literal", "expected": "object", "path": ["tools", 0, "inputSchema", "type"]` indicate that the Inspector is not finding `type: "object"` directly within the `inputSchema` it receives.

## 2. `zod-to-json-schema` Default Behavior

- **Problem:** The `zod-to-json-schema` library, when converting Zod schemas, defaults to using `$ref` and a `definitions` block. This means the actual schema definition (including `type: "object"`) is nested inside `definitions`, and the top level of `inputSchema` contains `$ref` instead of `type`.
- **Example (Problematic Structure):**
  ```json
  "inputSchema": {
      "$ref": "#/definitions/...",
      "definitions": { "...": { "type": "object", ... } },
      "$schema": "..."
  }
  ```
- **Impact:** This default structure doesn't meet the Inspector's expectation for a direct `type: "object"` at the top level of `inputSchema`.

## 3. The Solution: `$refStrategy: 'none'`

- **Solution:** To resolve the mismatch, configure `zod-to-json-schema` to inline the schema definition directly into the `inputSchema` object, avoiding the use of `$ref` and `definitions`.
- **Implementation:** Pass the options object `{ $refStrategy: 'none' }` as the second argument to the `zodToJsonSchema` function:
  ```typescript
  import { zodToJsonSchema } from "zod-to-json-schema";
  // ...
  const jsonSchema = zodToJsonSchema(tool.inputSchema, { $refStrategy: 'none' });
  ```
- **Result (Correct Structure):**
  ```json
  "inputSchema": {
      "type": "object",
      "properties": { ... },
      "required": [ ... ],
      "additionalProperties": false,
      "$schema": "..."
  }
  ```

## 4. Debugging Techniques

- **Incremental Logging:** When the source of the error was unclear, adding `console.error` statements at different stages of the `listTools` handler helped pinpoint the failure:
    1. Log on handler entry (`HANDLER ENTERED`).
    2. Log before/after potentially failing operations (like `zodToJsonSchema`).
    3. Log the exact data structure *before* returning it (`Final tools structure: ...`).
- **Isolate the Environment:** Ensure testing occurs against the server instance managed by the Inspector (`npx @modelcontextprotocol/inspector node ...`) and not a separate, manually started server (`npm run start`). Logs should be checked in the Inspector's terminal output.
- **Clear Build Artifacts:** When code changes don't seem to take effect, remove the build output directory (`rm -rf dist` or similar) and rebuild (`npm run build`) to rule out caching issues.
- **Try-Catch Blocks:** Wrap potentially problematic function calls (like `zodToJsonSchema`) in `try...catch` blocks to explicitly capture and log errors that might otherwise be missed.
