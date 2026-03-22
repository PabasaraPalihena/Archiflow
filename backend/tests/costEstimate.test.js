// Manual testing with curl:
//
// POST /api/cost/estimate:
// curl -X POST http://localhost:5001/api/cost/estimate \
//   -H "Content-Type: application/json" \
//   -d '{"diagram": {"@context": {"wam": "https://tucid/cpm/wam#", "rdfs": "http://www.w3.org/2000/01/rdf-schema#"}, "@graph": [{"@id": "svc-1", "@type": "wam:service", "rdfs:label": "Test API", "wam:apiStyle": "REST"}]}}'
//
// GET /api/cost/pricing:
// curl http://localhost:5001/api/cost/pricing

/**
 * Tests for costEstimate.js route
 * Run with: node backend/routes/costEstimate.test.js
 */

const { parseDiagram } = require("../common/diagramParser");
const { estimateCost } = require("../common/costEstimator");
const pricingReference = require("../common/pricingReference.json");

// ============================================================
// Test Fixtures
// ============================================================

const model_simpleRealm = {
  "@context": {
    wam: "https://tucid/cpm/wam#",
    ex: "https://tucid/cpm/diagram#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  },
  "@graph": [
    {
      "@id": "ex:realm-1",
      "@type": "wam:securityRealm",
      "rdfs:label": "Corporate Realm",
    },
    {
      "@id": "ex:svc-1",
      "@type": "wam:service",
      "rdfs:label": "User API",
      "wam:apiStyle": "REST",
    },
    {
      "@id": "ex:app-1",
      "@type": "wam:application",
      "rdfs:label": "Web Portal",
      "wam:publicFacing": true,
    },
    {
      "@id": "ex:inv-1",
      "@type": "wam:invocation",
      "wam:from": { "@id": "ex:app-1" },
      "wam:to": { "@id": "ex:svc-1" },
      "wam:protocol": "HTTPS",
      "wam:encrypted": true,
    },
  ],
};

const model_fullFederation = {
  "@context": {
    wam: "https://tucid/cpm/wam#",
    ex: "https://tucid/cpm/diagram#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  },
  "@graph": [
    {
      "@id": "ex:realm-internal",
      "@type": "wam:securityRealm",
      "rdfs:label": "Internal Realm",
    },
    {
      "@id": "ex:realm-partner",
      "@type": "wam:securityRealm",
      "rdfs:label": "Partner Realm",
    },
    {
      "@id": "ex:idp-1",
      "@type": "wam:identityProvider",
      "rdfs:label": "Corporate IdP",
    },
    {
      "@id": "ex:idp-2",
      "@type": "wam:identityProvider",
      "rdfs:label": "Partner IdP",
    },
    {
      "@id": "ex:svc-1",
      "@type": "wam:service",
      "rdfs:label": "Order API",
      "wam:apiStyle": "gRPC",
    },
    {
      "@id": "ex:svc-2",
      "@type": "wam:service",
      "rdfs:label": "Inventory API",
      "wam:apiStyle": "REST",
    },
    {
      "@id": "ex:app-1",
      "@type": "wam:application",
      "rdfs:label": "Partner Portal",
      "wam:publicFacing": true,
    },
    {
      "@id": "ex:db-1",
      "@type": "wam:dataProvider",
      "rdfs:label": "Order Database",
      "wam:databaseType": "SQL",
    },
    {
      "@id": "ex:trust-1",
      "@type": "wam:trust",
      "wam:from": { "@id": "ex:realm-internal" },
      "wam:to": { "@id": "ex:realm-partner" },
    },
    {
      "@id": "ex:inv-1",
      "@type": "wam:invocation",
      "wam:from": { "@id": "ex:app-1" },
      "wam:to": { "@id": "ex:svc-1" },
      "wam:protocol": "HTTPS",
      "wam:encrypted": true,
    },
    {
      "@id": "ex:inv-2",
      "@type": "wam:invocation",
      "wam:from": { "@id": "ex:svc-1" },
      "wam:to": { "@id": "ex:svc-2" },
      "wam:protocol": "gRPC",
      "wam:encrypted": true,
    },
    {
      "@id": "ex:inv-3",
      "@type": "wam:invocation",
      "wam:from": { "@id": "ex:svc-2" },
      "wam:to": { "@id": "ex:db-1" },
      "wam:protocol": "TCP",
    },
  ],
};

// ============================================================
// Test Runner
// ============================================================

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

/**
 * Simulates what the route handler does: parse -> estimate -> format response
 */
function simulateRouteHandler(diagram) {
  // Validate diagram
  if (!diagram || typeof diagram !== "object" || !diagram["@graph"]) {
    return {
      status: 400,
      body: {
        success: false,
        error: "Missing or invalid diagram. Expected a JSON-LD object with @context and @graph.",
      },
    };
  }

  // Parse
  let parsedResult;
  try {
    parsedResult = parseDiagram(diagram);
  } catch (parseErr) {
    return {
      status: 400,
      body: {
        success: false,
        error: `Failed to parse diagram: ${parseErr.message}`,
      },
    };
  }

  // Estimate
  let costResult;
  try {
    costResult = estimateCost(parsedResult, pricingReference);
  } catch (estimateErr) {
    return {
      status: 500,
      body: {
        success: false,
        error: `Failed to estimate cost: ${estimateErr.message}`,
      },
    };
  }

  // Check for errors from estimateCost
  if (costResult.errors && costResult.errors.length > 0) {
    return {
      status: 500,
      body: {
        success: false,
        error: `Failed to estimate cost: ${costResult.errors.join(", ")}`,
      },
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      data: {
        totalEstimate: costResult.totalEstimate,
        componentBreakdown: costResult.componentBreakdown,
        connectionBreakdown: costResult.connectionBreakdown,
        modifierBreakdown: costResult.modifierBreakdown,
        metadata: costResult.metadata,
      },
    },
  };
}

// ============================================================
// Tests
// ============================================================

console.log("=".repeat(50));
console.log("Cost Estimate Route Tests");
console.log("=".repeat(50));

// Test 1: Simple realm model
console.log("\n--- Test: model_simpleRealm ---");
{
  const result = simulateRouteHandler(model_simpleRealm);

  assert(result.status === 200, "Returns status 200");
  assert(result.body.success === true, "Response has success: true");
  assert(result.body.data !== undefined, "Response has data field");
  assert(result.body.data.totalEstimate !== undefined, "Response has totalEstimate");
  assert(
    typeof result.body.data.totalEstimate.small === "number",
    "totalEstimate.small is a number"
  );
  assert(
    typeof result.body.data.totalEstimate.production === "number",
    "totalEstimate.production is a number"
  );
  assert(
    typeof result.body.data.totalEstimate.enterprise === "number",
    "totalEstimate.enterprise is a number"
  );
  assert(
    Array.isArray(result.body.data.componentBreakdown),
    "componentBreakdown is an array"
  );
  assert(
    Array.isArray(result.body.data.connectionBreakdown),
    "connectionBreakdown is an array"
  );
  assert(
    Array.isArray(result.body.data.modifierBreakdown),
    "modifierBreakdown is an array"
  );
  assert(result.body.data.metadata !== undefined, "Response has metadata");
  assert(
    result.body.data.metadata.currency === "USD",
    "metadata.currency is USD"
  );

  console.log(`  Total estimate: $${result.body.data.totalEstimate.small} - $${result.body.data.totalEstimate.enterprise}`);
}

// Test 2: Full federation model
console.log("\n--- Test: model_fullFederation ---");
{
  const result = simulateRouteHandler(model_fullFederation);

  assert(result.status === 200, "Returns status 200");
  assert(result.body.success === true, "Response has success: true");
  assert(
    result.body.data.componentBreakdown.length === 8,
    `componentBreakdown has 8 items (got ${result.body.data.componentBreakdown.length})`
  );
  assert(
    result.body.data.connectionBreakdown.length === 4,
    `connectionBreakdown has 4 items (got ${result.body.data.connectionBreakdown.length})`
  );
  assert(
    result.body.data.modifierBreakdown.length === 3,
    `modifierBreakdown has 3 items (got ${result.body.data.modifierBreakdown.length})`
  );

  // Check cross-realm modifier is applied (2 realms + 1 trust connection)
  const crossRealmMod = result.body.data.modifierBreakdown.find(
    (m) => m.modifier === "crossRealm"
  );
  assert(crossRealmMod !== undefined, "Has crossRealm modifier");
  assert(crossRealmMod.applied === true, "crossRealm modifier is applied");

  console.log(`  Total estimate: $${result.body.data.totalEstimate.small} - $${result.body.data.totalEstimate.enterprise}`);
}

// Test 3: null diagram
console.log("\n--- Test: null diagram ---");
{
  const result = simulateRouteHandler(null);

  assert(result.status === 400, "Returns status 400 for null");
  assert(result.body.success === false, "Response has success: false");
  assert(
    result.body.error.includes("Missing or invalid diagram"),
    "Error message mentions missing diagram"
  );
}

// Test 4: Empty object
console.log("\n--- Test: empty object {} ---");
{
  const result = simulateRouteHandler({});

  assert(result.status === 400, "Returns status 400 for empty object");
  assert(result.body.success === false, "Response has success: false");
  assert(
    result.body.error.includes("Missing or invalid diagram"),
    "Error message mentions missing diagram"
  );
}

// Test 5: Empty @graph array
console.log("\n--- Test: empty @graph [] ---");
{
  const diagram = {
    "@context": { wam: "https://tucid/cpm/wam#" },
    "@graph": [],
  };
  const result = simulateRouteHandler(diagram);

  assert(result.status === 200, "Returns status 200 for empty @graph");
  assert(result.body.success === true, "Response has success: true");
  assert(
    result.body.data.totalEstimate.small === 0,
    "totalEstimate.small is 0 for empty diagram"
  );
  assert(
    result.body.data.totalEstimate.production === 0,
    "totalEstimate.production is 0 for empty diagram"
  );
  assert(
    result.body.data.totalEstimate.enterprise === 0,
    "totalEstimate.enterprise is 0 for empty diagram"
  );
  assert(
    result.body.data.componentBreakdown.length === 0,
    "componentBreakdown is empty"
  );
  assert(
    result.body.data.connectionBreakdown.length === 0,
    "connectionBreakdown is empty"
  );
}

// Test 6: Missing @context (should still work)
console.log("\n--- Test: missing @context ---");
{
  const diagram = {
    "@graph": [
      {
        "@id": "ex:svc-1",
        "@type": "wam:service",
        "rdfs:label": "Test Service",
      },
    ],
  };
  const result = simulateRouteHandler(diagram);

  assert(result.status === 200, "Returns status 200 without @context");
  assert(result.body.success === true, "Response has success: true");
  assert(
    result.body.data.componentBreakdown.length === 1,
    "Parses the service component"
  );
}

// Test 7: Verify response structure matches expected format
console.log("\n--- Test: response structure validation ---");
{
  const result = simulateRouteHandler(model_simpleRealm);
  const data = result.body.data;

  // Check totalEstimate structure
  assert(
    "small" in data.totalEstimate &&
      "production" in data.totalEstimate &&
      "enterprise" in data.totalEstimate,
    "totalEstimate has small, production, enterprise"
  );

  // Check componentBreakdown item structure
  if (data.componentBreakdown.length > 0) {
    const comp = data.componentBreakdown[0];
    assert("id" in comp, "componentBreakdown item has id");
    assert("label" in comp, "componentBreakdown item has label");
    assert("type" in comp, "componentBreakdown item has type");
    assert("tierCosts" in comp, "componentBreakdown item has tierCosts");
    assert("defaultEstimate" in comp, "componentBreakdown item has defaultEstimate");
  }

  // Check connectionBreakdown item structure
  if (data.connectionBreakdown.length > 0) {
    const conn = data.connectionBreakdown[0];
    assert("id" in conn, "connectionBreakdown item has id");
    assert("type" in conn, "connectionBreakdown item has type");
    assert("from" in conn, "connectionBreakdown item has from");
    assert("to" in conn, "connectionBreakdown item has to");
    assert("cost" in conn, "connectionBreakdown item has cost");
  }

  // Check modifierBreakdown item structure
  if (data.modifierBreakdown.length > 0) {
    const mod = data.modifierBreakdown[0];
    assert("modifier" in mod, "modifierBreakdown item has modifier");
    assert("applied" in mod, "modifierBreakdown item has applied");
    assert("cost" in mod, "modifierBreakdown item has cost");
    assert("reason" in mod, "modifierBreakdown item has reason");
  }

  // Check metadata structure
  assert("diagramComponentCount" in data.metadata, "metadata has diagramComponentCount");
  assert("diagramConnectionCount" in data.metadata, "metadata has diagramConnectionCount");
  assert("estimatedAt" in data.metadata, "metadata has estimatedAt");
  assert("pricingVersion" in data.metadata, "metadata has pricingVersion");
  assert("currency" in data.metadata, "metadata has currency");
  assert("billingPeriod" in data.metadata, "metadata has billingPeriod");
}

// Test 8: GET /pricing response
console.log("\n--- Test: pricing reference structure ---");
{
  // Simulate GET /pricing response
  const pricingResponse = {
    success: true,
    data: pricingReference,
  };

  assert(pricingResponse.success === true, "Pricing response has success: true");
  assert(pricingResponse.data.version !== undefined, "Pricing data has version");
  assert(pricingResponse.data.currency === "USD", "Pricing currency is USD");
  assert(pricingResponse.data.components !== undefined, "Pricing has components");
  assert(pricingResponse.data.connections !== undefined, "Pricing has connections");
  assert(pricingResponse.data.modifiers !== undefined, "Pricing has modifiers");
}

// ============================================================
// Summary
// ============================================================

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
