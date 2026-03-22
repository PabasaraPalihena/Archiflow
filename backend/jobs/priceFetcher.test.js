// Manual testing:
// curl -X POST http://localhost:5001/api/cost/update-prices

/**
 * Tests for priceFetcher.js
 * Run with: node backend/jobs/priceFetcher.test.js
 */

const fs = require("fs");
const path = require("path");
const {
  updatePrices,
  mergePricingData,
  validatePricingData,
  FALLBACK_PRICES,
  PRICING_FILE,
  BACKUP_FILE,
} = require("./priceFetcher");

// ============================================================
// Test Runner
// ============================================================

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    testsPassed++;
    console.log(`  \u2713 ${message}`);
  } else {
    testsFailed++;
    console.log(`  \u2717 ${message}`);
  }
}

// ============================================================
// Test Fixtures
// ============================================================

function getMinimalPricingReference() {
  return {
    version: "1.0.0",
    currency: "EUR",
    billingPeriod: "monthly",
    lastUpdated: "2026-01-01",
    components: {
      service: {
        description: "Web service",
        tiers: {
          low: { cost: 5, label: "Serverless", description: "Serverless" },
          medium: { cost: 75, label: "Container", description: "Container" },
          high: { cost: 400, label: "Dedicated", description: "Dedicated" },
        },
        defaultTier: "medium",
        modifiers: {},
      },
      application: {
        description: "Web frontend",
        tiers: {
          low: { cost: 3, label: "Static", description: "Static" },
          medium: { cost: 20, label: "Managed", description: "Managed" },
          high: { cost: 150, label: "Dedicated", description: "Dedicated" },
        },
        defaultTier: "medium",
        modifiers: {},
      },
      dataProvider: {
        description: "Database",
        tiers: {
          low: { cost: 15, label: "Small DB", description: "Small DB" },
          medium: { cost: 100, label: "Prod DB", description: "Prod DB" },
          high: { cost: 500, label: "Multi-AZ", description: "Multi-AZ" },
        },
        defaultTier: "medium",
        modifiers: {},
      },
      identityProvider: {
        description: "Auth service",
        tiers: {
          low: { cost: 0, label: "Free Tier", description: "Free" },
          medium: { cost: 35, label: "Essentials", description: "Essentials" },
          high: { cost: 200, label: "Enterprise", description: "Enterprise" },
        },
        defaultTier: "medium",
        modifiers: {},
      },
      processUnit: {
        description: "Background compute",
        tiers: {
          low: { cost: 2, label: "Scheduled", description: "Scheduled" },
          medium: { cost: 30, label: "Worker", description: "Worker" },
          high: { cost: 200, label: "Dedicated", description: "Dedicated" },
        },
        defaultTier: "medium",
        modifiers: {},
      },
      securityRealm: {
        description: "Security realm",
        tiers: {
          low: { cost: 0, label: "Logical", description: "Logical" },
          medium: { cost: 10, label: "VPC", description: "VPC" },
          high: { cost: 50, label: "Dedicated VPC", description: "Dedicated" },
        },
        defaultTier: "low",
        modifiers: {},
      },
    },
    connections: {
      invocation: { description: "API call", baseCost: 0, protocolCosts: {} },
      trust: { description: "Trust", baseCost: 5 },
      legacyConnection: { description: "Legacy", baseCost: 10 },
    },
    modifiers: {
      encryption: { description: "TLS", cost: 5, applicationType: "once" },
      publicFacing: { description: "LB + WAF", cost: 25, applicationType: "once" },
      crossRealm: { description: "API Gateway", cost: 20, applicationType: "perPair" },
    },
  };
}

// ============================================================
// Tests
// ============================================================

console.log("=".repeat(50));
console.log("Price Fetcher Tests");
console.log("=".repeat(50));

// --- Test: Merge logic with partial results (only Azure succeeded) ---
console.log("\n--- Test: mergePricingData with partial results ---");
{
  const current = getMinimalPricingReference();

  // Simulate only Azure returning data
  const results = {
    aws: null,
    azure: FALLBACK_PRICES.azure,
    gcp: null,
  };

  const { data: merged, changedCount } = mergePricingData(current, results);

  assert(merged.components.service.tiers.low.providers !== undefined, "service.low has providers after merge");
  assert(
    merged.components.service.tiers.low.providers.azure !== undefined,
    "service.low.providers.azure exists"
  );
  assert(
    merged.components.service.tiers.low.providers.aws === undefined,
    "service.low.providers.aws is undefined (AWS failed)"
  );
  assert(
    merged.components.service.tiers.low.providers.gcp === undefined,
    "service.low.providers.gcp is undefined (GCP failed)"
  );
  assert(
    typeof merged.components.service.tiers.low.cost === "number" && merged.components.service.tiers.low.cost > 0,
    "service.low.cost is a positive number after merge"
  );
  assert(merged.lastUpdated !== "2026-01-01", "lastUpdated was updated");
  assert(changedCount > 0, `changedCount is positive (got ${changedCount})`);
}

// --- Test: Merge logic with all providers ---
console.log("\n--- Test: mergePricingData with all providers ---");
{
  const current = getMinimalPricingReference();

  const results = {
    aws: FALLBACK_PRICES.aws,
    azure: FALLBACK_PRICES.azure,
    gcp: FALLBACK_PRICES.gcp,
  };

  const { data: merged, changedCount } = mergePricingData(current, results);

  // All three providers should exist on service.low
  assert(
    merged.components.service.tiers.low.providers.aws !== undefined,
    "All providers: aws exists"
  );
  assert(
    merged.components.service.tiers.low.providers.azure !== undefined,
    "All providers: azure exists"
  );
  assert(
    merged.components.service.tiers.low.providers.gcp !== undefined,
    "All providers: gcp exists"
  );

  // Cost should be average of three providers
  const awsCost = FALLBACK_PRICES.aws.service.low.monthlyCost;
  const azureCost = FALLBACK_PRICES.azure.service.low.monthlyCost;
  const gcpCost = FALLBACK_PRICES.gcp.service.low.monthlyCost;
  const expectedAvg = Math.round(((awsCost + azureCost + gcpCost) / 3) * 100) / 100;
  assert(
    merged.components.service.tiers.low.cost === expectedAvg,
    `service.low.cost is average: ${merged.components.service.tiers.low.cost} === ${expectedAvg}`
  );
}

// --- Test: Merge preserves existing providers when a provider fails ---
console.log("\n--- Test: mergePricingData preserves existing provider data ---");
{
  const current = getMinimalPricingReference();
  // Pre-populate aws provider data
  current.components.service.tiers.low.providers = {
    aws: { service: "Lambda", monthlyCost: 4.50, unit: "per 1M requests", lastUpdated: "2026-02-20" },
  };

  // Only azure returns data this time
  const results = { aws: null, azure: FALLBACK_PRICES.azure, gcp: null };
  const { data: merged } = mergePricingData(current, results);

  assert(
    merged.components.service.tiers.low.providers.aws.monthlyCost === 4.50,
    "Existing AWS data is preserved when AWS fetch fails"
  );
  assert(
    merged.components.service.tiers.low.providers.azure !== undefined,
    "Azure data was added"
  );
}

// --- Test: Validation rejects corrupt data ---
console.log("\n--- Test: validatePricingData rejects corrupt data ---");
{
  assert(validatePricingData(null) !== null, "Rejects null");
  assert(validatePricingData("string") !== null, "Rejects string");
  assert(validatePricingData({}) !== null, "Rejects empty object");
  assert(validatePricingData({ components: {}, connections: {} }) !== null, "Rejects missing modifiers");

  // Negative cost
  const badData = getMinimalPricingReference();
  badData.components.service.tiers.low.cost = -10;
  assert(validatePricingData(badData) !== null, "Rejects negative cost");

  // NaN cost
  const nanData = getMinimalPricingReference();
  nanData.components.service.tiers.low.cost = NaN;
  assert(validatePricingData(nanData) !== null, "Rejects NaN cost");

  // Valid data
  const goodData = getMinimalPricingReference();
  assert(validatePricingData(goodData) === null, "Accepts valid data");
}

// --- Test: Validate the real pricingReference.json ---
console.log("\n--- Test: current pricingReference.json is valid ---");
{
  try {
    const raw = fs.readFileSync(PRICING_FILE, "utf-8");
    const data = JSON.parse(raw);
    const error = validatePricingData(data);
    assert(error === null, `pricingReference.json passes validation (error: ${error})`);
    assert(data.version !== undefined, "Has version field");
    assert(data.currency === "EUR", "Currency is EUR");
    assert(data.lastUpdated !== undefined, "Has lastUpdated field");
  } catch (err) {
    assert(false, `Failed to read/parse pricingReference.json: ${err.message}`);
  }
}

// --- Test: Backup logic ---
console.log("\n--- Test: backup file creation ---");
{
  // Create a temp test to verify backup works
  const testBackupSrc = path.join(__dirname, "..", "common", "pricingReference.json");
  const testBackupDst = path.join(__dirname, "..", "common", "pricingReference.backup.json");

  // Backup should be created by updatePrices(), but let's test the fs.copyFileSync pattern
  try {
    fs.copyFileSync(testBackupSrc, testBackupDst);
    const exists = fs.existsSync(testBackupDst);
    assert(exists, "Backup file was created successfully");

    // Verify content matches
    const src = fs.readFileSync(testBackupSrc, "utf-8");
    const dst = fs.readFileSync(testBackupDst, "utf-8");
    assert(src === dst, "Backup file content matches source");

    // Clean up
    fs.unlinkSync(testBackupDst);
  } catch (err) {
    assert(false, `Backup test failed: ${err.message}`);
  }
}

// --- Test: updatePrices() never throws ---
console.log("\n--- Test: updatePrices() never throws ---");
{
  (async () => {
    try {
      const summary = await updatePrices();
      assert(summary !== null && summary !== undefined, "updatePrices() returns a summary");
      assert(Array.isArray(summary.providersUpdated), "summary.providersUpdated is an array");
      assert(Array.isArray(summary.providersFailed), "summary.providersFailed is an array");
      assert(Array.isArray(summary.errors), "summary.errors is an array");
      assert(typeof summary.pricesChanged === "number", "summary.pricesChanged is a number");
      assert(typeof summary.timestamp === "string", "summary.timestamp is a string");
    } catch (err) {
      assert(false, `updatePrices() threw an error: ${err.message}`);
    }

    // Clean up backup file if it was created
    try {
      if (fs.existsSync(BACKUP_FILE)) {
        fs.unlinkSync(BACKUP_FILE);
      }
    } catch (_) {
      // ignore cleanup errors
    }

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
  })();
}
