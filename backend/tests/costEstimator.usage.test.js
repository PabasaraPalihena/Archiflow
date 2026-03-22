/**
 * Tests for estimateCostWithUsage() in costEstimator.js
 * Run with: node backend/common/costEstimator.usage.test.js
 */

const { parseDiagram } = require("../common/diagramParser");
const { estimateCost, estimateCostWithUsage } = require("../common/costEstimator");
const pricingReference = require("../common/pricingReference.json");
const usageFields = require("../common/usageFields.json");
const {
  parser_model5_mixedComponents,
  parser_model8_fullFederation,
  cost_simpleRealm,
  cost_mixedComponents,
  cost_fullFederation,
} = require("./fixtures");

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  ✓ ${message}`);
  } else {
    testsFailed++;
    console.log(`  ✗ ${message}`);
  }
}

// ============================================================
// TEST 1: Usage estimation with no overrides returns reasonable defaults
// ============================================================
console.log("\n========================================");
console.log("TEST 1: No overrides — defaults used");
console.log("========================================");

{
  const parsed = parseDiagram(parser_model5_mixedComponents);
  const result = estimateCostWithUsage(parsed, pricingReference, {});

  console.log(`\n  Total estimate: €${result.totalEstimate}`);
  console.log(`  Components: ${result.componentBreakdown.length}`);
  console.log(`  Connections: ${result.connectionBreakdown.length}`);

  assert(
    typeof result.totalEstimate === "number" && !isNaN(result.totalEstimate),
    "totalEstimate is a valid number"
  );
  assert(
    result.totalEstimate > 0,
    `totalEstimate (€${result.totalEstimate}) is greater than 0`
  );
  assert(
    result.componentBreakdown.length === parsed.summary.totalComponents,
    `componentBreakdown count (${result.componentBreakdown.length}) matches parsed components (${parsed.summary.totalComponents})`
  );
  assert(
    result.connectionBreakdown.length === parsed.summary.totalConnections,
    `connectionBreakdown count (${result.connectionBreakdown.length}) matches parsed connections (${parsed.summary.totalConnections})`
  );
  assert(
    result.metadata.mode === "usage-based",
    `metadata.mode is "usage-based" (got "${result.metadata.mode}")`
  );
  assert(
    result.metadata.currency === "EUR",
    `metadata.currency is "EUR" (got "${result.metadata.currency}")`
  );
  assert(
    result.metadata.billingPeriod === "monthly",
    `metadata.billingPeriod is "monthly" (got "${result.metadata.billingPeriod}")`
  );
}

// ============================================================
// TEST 2: Usage estimation with specific overrides changes costs
// ============================================================
console.log("\n========================================");
console.log("TEST 2: Specific overrides change costs");
console.log("========================================");

{
  const parsed = parseDiagram(parser_model5_mixedComponents);

  // Get baseline with no overrides
  const baseline = estimateCostWithUsage(parsed, pricingReference, {});

  // Now override: give svc-1 high request volume
  const overrides = {
    components: {
      "svc-1": { requestsPerMonth: 5000000, memoryMB: 1024 },
    },
    connections: {},
  };
  const withOverrides = estimateCostWithUsage(parsed, pricingReference, overrides);

  console.log(`\n  Baseline total: €${baseline.totalEstimate}`);
  console.log(`  With overrides total: €${withOverrides.totalEstimate}`);

  // The service component with 5M requests and 1024MB should cost differently than default 100K/256MB
  const baselineService = baseline.componentBreakdown.find((c) => c.id === "svc-1");
  const overrideService = withOverrides.componentBreakdown.find((c) => c.id === "svc-1");

  console.log(`  Baseline service cost: €${baselineService.cost}`);
  console.log(`  Override service cost: €${overrideService.cost}`);

  assert(
    overrideService.cost !== baselineService.cost,
    `Service cost changed with overrides (€${baselineService.cost} -> €${overrideService.cost})`
  );
  assert(
    overrideService.cost > baselineService.cost,
    `Service cost increased with higher usage (€${baselineService.cost} -> €${overrideService.cost})`
  );
}

// ============================================================
// TEST 3: dataProvider with storageGB=100, multiAZ=true costs more
// ============================================================
console.log("\n========================================");
console.log("TEST 3: dataProvider with high storage + multiAZ");
console.log("========================================");

{
  const parsed = parseDiagram(parser_model5_mixedComponents);

  const baseline = estimateCostWithUsage(parsed, pricingReference, {});
  const overrides = {
    components: {
      "dp-1": { storageGB: 100, multiAZ: true },
    },
    connections: {},
  };
  const withOverrides = estimateCostWithUsage(parsed, pricingReference, overrides);

  const baselineDP = baseline.componentBreakdown.find((c) => c.id === "dp-1");
  const overrideDP = withOverrides.componentBreakdown.find((c) => c.id === "dp-1");

  console.log(`\n  Baseline dataProvider cost: €${baselineDP.cost}`);
  console.log(`  Override dataProvider cost: €${overrideDP.cost}`);

  assert(
    overrideDP.cost > baselineDP.cost,
    `dataProvider cost increased (€${baselineDP.cost} -> €${overrideDP.cost}) with storageGB=100 and multiAZ=true`
  );

  // With multiAZ, the base should roughly double + extra storage
  assert(
    overrideDP.cost > baselineDP.cost * 1.5,
    `dataProvider cost is significantly higher (>1.5x baseline) with multiAZ`
  );
}

// ============================================================
// TEST 4: costDetails string is present and non-empty for each component
// ============================================================
console.log("\n========================================");
console.log("TEST 4: costDetails present for all items");
console.log("========================================");

{
  const parsed = parseDiagram(parser_model8_fullFederation);
  const result = estimateCostWithUsage(parsed, pricingReference, {});

  const allComponentDetailsPresent = result.componentBreakdown.every(
    (comp) => typeof comp.costDetails === "string" && comp.costDetails.length > 0
  );
  assert(allComponentDetailsPresent, "All components have non-empty costDetails strings");

  const allConnectionDetailsPresent = result.connectionBreakdown.every(
    (conn) => typeof conn.costDetails === "string" && conn.costDetails.length > 0
  );
  assert(allConnectionDetailsPresent, "All connections have non-empty costDetails strings");

  // Print a sample
  if (result.componentBreakdown.length > 0) {
    console.log(`\n  Sample costDetails: "${result.componentBreakdown[0].costDetails.substring(0, 100)}..."`);
  }
}

// ============================================================
// TEST 5: Regression — estimateCost() still works exactly as before
// ============================================================
console.log("\n========================================");
console.log("TEST 5: Regression — estimateCost() unchanged");
console.log("========================================");

{
  // Test all three cost models to ensure nothing broke
  const models = [
    { name: "cost_simpleRealm", model: cost_simpleRealm },
    { name: "cost_mixedComponents", model: cost_mixedComponents },
    { name: "cost_fullFederation", model: cost_fullFederation },
  ];

  for (const { name, model } of models) {
    const parsed = parseDiagram(model);
    const result = estimateCost(parsed, pricingReference);

    assert(
      result.totalEstimate.small < result.totalEstimate.production,
      `[${name}] low < medium (€${result.totalEstimate.small} < €${result.totalEstimate.production})`
    );
    assert(
      result.totalEstimate.production < result.totalEstimate.enterprise,
      `[${name}] medium < high (€${result.totalEstimate.production} < €${result.totalEstimate.enterprise})`
    );
    assert(
      result.componentBreakdown.length === parsed.summary.totalComponents,
      `[${name}] component count matches (${result.componentBreakdown.length})`
    );
    assert(
      result.connectionBreakdown.length === parsed.summary.totalConnections,
      `[${name}] connection count matches (${result.connectionBreakdown.length})`
    );
    assert(
      result.modifierBreakdown.length === 3,
      `[${name}] modifier count is 3`
    );
    assert(
      !result.errors,
      `[${name}] no errors returned`
    );
  }
}

// ============================================================
// TEST 6: Override for non-existent component ID is ignored
// ============================================================
console.log("\n========================================");
console.log("TEST 6: Non-existent component ID ignored");
console.log("========================================");

{
  const parsed = parseDiagram(parser_model5_mixedComponents);

  const baseline = estimateCostWithUsage(parsed, pricingReference, {});
  const overrides = {
    components: {
      "non-existent-id": { requestsPerMonth: 999999999 },
    },
    connections: {
      "fake-conn-id": { requestsPerMonth: 999999999 },
    },
  };
  const withBogus = estimateCostWithUsage(parsed, pricingReference, overrides);

  assert(
    baseline.totalEstimate === withBogus.totalEstimate,
    `Total unchanged when overriding non-existent IDs (€${baseline.totalEstimate} === €${withBogus.totalEstimate})`
  );
  assert(
    baseline.componentBreakdown.length === withBogus.componentBreakdown.length,
    "Component breakdown count unchanged with bogus overrides"
  );
}

// ============================================================
// TEST 7: Negative values treated as 0
// ============================================================
console.log("\n========================================");
console.log("TEST 7: Negative values clamped to 0");
console.log("========================================");

{
  const parsed = parseDiagram(parser_model5_mixedComponents);

  const overrides = {
    components: {
      "svc-1": { requestsPerMonth: -500000 },
    },
    connections: {},
  };
  const result = estimateCostWithUsage(parsed, pricingReference, overrides);

  const svc = result.componentBreakdown.find((c) => c.id === "svc-1");

  assert(
    typeof svc.cost === "number" && !isNaN(svc.cost),
    "Service cost is a valid number even with negative input"
  );
  assert(
    svc.cost >= 0,
    `Service cost (€${svc.cost}) is non-negative with negative requestsPerMonth input`
  );
}

// ============================================================
// TEST 8: Full federation model with usage overrides
// ============================================================
console.log("\n========================================");
console.log("TEST 8: Full federation model with overrides");
console.log("========================================");

{
  const parsed = parseDiagram(parser_model8_fullFederation);
  const overrides = {
    components: {
      "ws-1": { requestsPerMonth: 1000000, instanceCount: 3 },
      "data-1": { storageGB: 50, backupEnabled: true },
    },
    connections: {
      "inv-1": { requestsPerMonth: 500000, needsApiGateway: true },
    },
  };
  const result = estimateCostWithUsage(parsed, pricingReference, overrides);

  console.log(`\n  Total estimate: €${result.totalEstimate}`);

  assert(
    result.totalEstimate > 0,
    `Total estimate (€${result.totalEstimate}) is positive`
  );
  assert(
    !result.errors,
    "No errors returned"
  );

  // ws-1 with 3 instances should use container path
  const ws1 = result.componentBreakdown.find((c) => c.id === "ws-1");
  assert(
    ws1 && ws1.cost > 0,
    `WS1 cost (€${ws1?.cost}) is positive with 3 instances`
  );
  assert(
    ws1 && ws1.costDetails.includes("instances"),
    "WS1 costDetails mentions instances (container path)"
  );

  // inv-1 with API gateway should have gateway costs
  const inv1 = result.connectionBreakdown.find((c) => c.id === "inv-1");
  assert(
    inv1 && inv1.cost > 0,
    `inv-1 cost (€${inv1?.cost}) is positive with API gateway`
  );
  assert(
    inv1 && inv1.costDetails.includes("API Gateway"),
    "inv-1 costDetails mentions API Gateway"
  );

  // data-1 with backup should cost more than without
  const data1 = result.componentBreakdown.find((c) => c.id === "data-1");
  assert(
    data1 && data1.costDetails.includes("Backup"),
    "data-1 costDetails mentions Backup"
  );
}

// ============================================================
// TEST 9: All component types compute valid costs with defaults
// ============================================================
console.log("\n========================================");
console.log("TEST 9: All component types produce valid costs");
console.log("========================================");

{
  const parsed = parseDiagram(parser_model8_fullFederation);
  const result = estimateCostWithUsage(parsed, pricingReference, {});

  const allCostsValid = result.componentBreakdown.every(
    (comp) => typeof comp.cost === "number" && !isNaN(comp.cost) && comp.cost >= 0
  );
  assert(allCostsValid, "All component costs are valid non-negative numbers");

  const allConnCostsValid = result.connectionBreakdown.every(
    (conn) => typeof conn.cost === "number" && !isNaN(conn.cost) && conn.cost >= 0
  );
  assert(allConnCostsValid, "All connection costs are valid non-negative numbers");

  // Verify the total is the sum of parts
  const componentSum = result.componentBreakdown.reduce((s, c) => s + c.cost, 0);
  const connectionSum = result.connectionBreakdown.reduce((s, c) => s + c.cost, 0);
  const modifierSum = result.modifierBreakdown.reduce((s, m) => s + m.cost, 0);
  const expectedTotal = Math.round((componentSum + connectionSum + modifierSum) * 100) / 100;

  assert(
    Math.abs(result.totalEstimate - expectedTotal) < 0.02,
    `Total (€${result.totalEstimate}) matches sum of parts (€${expectedTotal})`
  );
}

// ============================================================
// Print summary
// ============================================================
console.log(`\n${"=".repeat(50)}`);
console.log("Usage Estimator Test Summary");
console.log("=".repeat(50));
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);
console.log(`Total:  ${testsPassed + testsFailed}`);

if (testsFailed > 0) {
  console.log("\nSome tests failed!");
  process.exit(1);
} else {
  console.log("\nAll tests passed!");
  process.exit(0);
}
