/**
 * Tests for diagramParser.js
 * Run with: node backend/tests/diagramParser.test.js
 */

const { parseDiagram } = require("../common/diagramParser");
const { parserModels, parserExpectedCounts } = require("./fixtures");

// ============================================================
// Test Runner
// ============================================================

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.log(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

console.log("=== Testing diagramParser ===\n");

// Loop through all models
for (const [modelName, model] of Object.entries(parserModels)) {
  console.log(`\n--- Testing ${modelName} ---`);

  let result;
  try {
    result = parseDiagram(model);
  } catch (err) {
    console.log(`  ✗ FAIL: Failed to parse - ${err.message}`);
    failed++;
    continue;
  }

  // Get expected counts
  const expected = parserExpectedCounts[modelName];

  // Test component count
  assert(
    result.summary.totalComponents === expected.components,
    `Components: expected ${expected.components}, got ${result.summary.totalComponents}`
  );

  // Test connection count
  assert(
    result.summary.totalConnections === expected.connections,
    `Connections: expected ${expected.connections}, got ${result.summary.totalConnections}`
  );

  // Verify all components have labels (not just IDs)
  const allHaveLabels = result.components.every(
    (c) => c.label && c.label !== c.id
  );
  assert(allHaveLabels, "All components have labels resolved");

  // Verify connections have from/to resolved to labels
  const connectionsResolved = result.connections.every(
    (c) => c.from && c.to && c.fromId && c.toId
  );
  assert(connectionsResolved, "All connections have from/to resolved");

  // Print summary for this model
  console.log(
    `  Summary: ${result.summary.totalComponents} components, ${result.summary.totalConnections} connections`
  );
  console.log(`  Types: ${JSON.stringify(result.summary.componentCounts)}`);
}

// Test error handling
console.log("\n--- Testing Error Handling ---");

try {
  parseDiagram(null);
  assert(false, "Should throw error for null input");
} catch (err) {
  assert(
    err.message.includes("Invalid JSON-LD"),
    "Throws meaningful error for null input"
  );
}

try {
  parseDiagram({});
  assert(false, "Should throw error for missing @graph");
} catch (err) {
  assert(
    err.message.includes("@graph"),
    "Throws meaningful error for missing @graph"
  );
}

// Final Summary
console.log("\n=== Test Summary ===");
console.log(`Passed: ${passed}`);
console.log(`Failed: ${failed}`);

if (failed > 0) {
  process.exit(1);
}

console.log("\nAll tests passed!");
