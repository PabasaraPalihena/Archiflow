/**
 * Tests for costEstimator.js
 * Run with: node backend/tests/costEstimator.test.js
 */

const { parseDiagram } = require("../common/diagramParser");
const { estimateCost } = require("../common/costEstimator");
const pricingReference = require("../common/pricingReference.json");
const {
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

function runTestsForModel(modelName, model) {
  console.log(`\n========================================`);
  console.log(`Testing: ${modelName}`);
  console.log(`========================================`);

  // Parse the model
  const parsed = parseDiagram(model);
  console.log(`\nParsed diagram summary:`);
  console.log(`  Components: ${parsed.summary.totalComponents}`);
  console.log(`  Connections: ${parsed.summary.totalConnections}`);
  console.log(`  Has encryption: ${parsed.summary.hasEncryption}`);
  console.log(`  Has public-facing: ${parsed.summary.hasPublicFacing}`);

  // Estimate costs
  const result = estimateCost(parsed, pricingReference);

  console.log(`\nCost estimation result:`);
  console.log(`  Total Estimate (Low):    $${result.totalEstimate.small}`);
  console.log(`  Total Estimate (Medium): $${result.totalEstimate.production}`);
  console.log(`  Total Estimate (High):   $${result.totalEstimate.enterprise}`);

  console.log(`\nComponent Breakdown:`);
  for (const comp of result.componentBreakdown) {
    const modifiers = comp.appliedModifiers.length > 0
      ? ` [${comp.appliedModifiers.join(", ")}]`
      : "";
    console.log(`  - ${comp.label} (${comp.type}): $${comp.defaultEstimate}${modifiers}`);
  }

  console.log(`\nConnection Breakdown:`);
  for (const conn of result.connectionBreakdown) {
    console.log(`  - ${conn.type}: ${conn.from} -> ${conn.to}: $${conn.cost}`);
  }

  console.log(`\nModifier Breakdown:`);
  for (const mod of result.modifierBreakdown) {
    const status = mod.applied ? "Applied" : "Not applied";
    console.log(`  - ${mod.modifier}: ${status}, $${mod.cost} (${mod.reason})`);
  }

  console.log(`\nMetadata:`);
  console.log(`  Currency: ${result.metadata.currency}`);
  console.log(`  Billing Period: ${result.metadata.billingPeriod}`);
  console.log(`  Pricing Version: ${result.metadata.pricingVersion}`);
  console.log(`  Component Count: ${result.metadata.diagramComponentCount}`);
  console.log(`  Connection Count: ${result.metadata.diagramConnectionCount}`);

  // Run assertions
  console.log(`\nAssertions for ${modelName}:`);

  // Tier ordering: low < medium < high
  assert(
    result.totalEstimate.small < result.totalEstimate.production,
    "totalEstimate.small < totalEstimate.production"
  );
  assert(
    result.totalEstimate.production < result.totalEstimate.enterprise,
    "totalEstimate.production < totalEstimate.enterprise"
  );

  // Component breakdown count matches
  assert(
    result.componentBreakdown.length === parsed.summary.totalComponents,
    `componentBreakdown.length (${result.componentBreakdown.length}) matches parser component count (${parsed.summary.totalComponents})`
  );

  // Connection breakdown count matches
  assert(
    result.connectionBreakdown.length === parsed.summary.totalConnections,
    `connectionBreakdown.length (${result.connectionBreakdown.length}) matches parser connection count (${parsed.summary.totalConnections})`
  );

  // Modifier breakdown has exactly 3 entries
  assert(
    result.modifierBreakdown.length === 3,
    `modifierBreakdown has exactly 3 entries (got ${result.modifierBreakdown.length})`
  );

  // Currency is USD
  assert(
    result.metadata.currency === "USD",
    `metadata.currency is "USD" (got "${result.metadata.currency}")`
  );

  // All cost values are numbers and not NaN
  assert(
    typeof result.totalEstimate.small === "number" && !isNaN(result.totalEstimate.small),
    "totalEstimate.small is a valid number"
  );
  assert(
    typeof result.totalEstimate.production === "number" && !isNaN(result.totalEstimate.production),
    "totalEstimate.production is a valid number"
  );
  assert(
    typeof result.totalEstimate.enterprise === "number" && !isNaN(result.totalEstimate.enterprise),
    "totalEstimate.enterprise is a valid number"
  );

  // Check all component costs are valid numbers
  const allComponentCostsValid = result.componentBreakdown.every(
    (comp) =>
      typeof comp.tierCosts.small === "number" &&
      !isNaN(comp.tierCosts.small) &&
      typeof comp.tierCosts.production === "number" &&
      !isNaN(comp.tierCosts.production) &&
      typeof comp.tierCosts.enterprise === "number" &&
      !isNaN(comp.tierCosts.enterprise) &&
      typeof comp.defaultEstimate === "number" &&
      !isNaN(comp.defaultEstimate)
  );
  assert(allComponentCostsValid, "All component costs are valid numbers");

  // Check all connection costs are valid numbers
  const allConnectionCostsValid = result.connectionBreakdown.every(
    (conn) => typeof conn.cost === "number" && !isNaN(conn.cost)
  );
  assert(allConnectionCostsValid, "All connection costs are valid numbers");

  // Check all modifier costs are valid numbers
  const allModifierCostsValid = result.modifierBreakdown.every(
    (mod) => typeof mod.cost === "number" && !isNaN(mod.cost)
  );
  assert(allModifierCostsValid, "All modifier costs are valid numbers");

  return result;
}

// Run tests for all models
console.log("=".repeat(50));
console.log("Cost Estimator Tests");
console.log("=".repeat(50));

runTestsForModel("cost_simpleRealm", cost_simpleRealm);
runTestsForModel("cost_mixedComponents", cost_mixedComponents);
runTestsForModel("cost_fullFederation", cost_fullFederation);

// Print summary
console.log(`\n${"=".repeat(50)}`);
console.log("Test Summary");
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
