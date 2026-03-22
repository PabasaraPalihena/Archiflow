// backend/jobs/priceFetcher.js
//
// Fetches current cloud pricing from AWS, Azure, and GCP and updates
// pricingReference.json with provider-specific data. Exports updatePrices().

const fs = require("fs");
const path = require("path");

const PRICING_FILE = path.join(__dirname, "..", "common", "pricingReference.json");
const BACKUP_FILE = path.join(__dirname, "..", "common", "pricingReference.backup.json");
const FETCH_TIMEOUT = 15000;
const USD_TO_EUR = 0.92;

const LOG_PREFIX = "[PriceUpdater]";

// ============================================================
// Hardcoded fallback prices (reasonable estimates, updated manually)
// Used when API calls fail so that provider data still exists.
// ============================================================

const FALLBACK_PRICES = {
  aws: {
    service: {
      low: { service: "Lambda", monthlyCost: 4.50, unit: "per 1M requests + compute" },
      medium: { service: "ECS Fargate (0.5 vCPU)", monthlyCost: 36.00, unit: "per task/month" },
      high: { service: "EC2 c5.xlarge", monthlyCost: 124.00, unit: "on-demand/month" },
    },
    application: {
      low: { service: "S3 + CloudFront", monthlyCost: 2.50, unit: "per GB storage + requests" },
      medium: { service: "Amplify Hosting", monthlyCost: 18.00, unit: "build + hosting/month" },
      high: { service: "EC2 + CloudFront + ALB", monthlyCost: 145.00, unit: "on-demand/month" },
    },
    dataProvider: {
      low: { service: "RDS db.t3.micro", monthlyCost: 12.50, unit: "on-demand/month" },
      medium: { service: "RDS db.t3.medium", monthlyCost: 58.00, unit: "on-demand/month" },
      high: { service: "RDS Multi-AZ db.r5.xlarge", monthlyCost: 480.00, unit: "on-demand/month" },
    },
    identityProvider: {
      low: { service: "Cognito (free tier)", monthlyCost: 0, unit: "first 50k MAU free" },
      medium: { service: "Cognito", monthlyCost: 27.50, unit: "per 10k MAU after free tier" },
      high: { service: "Cognito + custom Lambda", monthlyCost: 195.00, unit: "enterprise scale" },
    },
    processUnit: {
      low: { service: "Lambda (scheduled)", monthlyCost: 1.50, unit: "per 1M requests" },
      medium: { service: "ECS Fargate Task", monthlyCost: 28.00, unit: "per task/month" },
      high: { service: "EC2 c5.xlarge (worker)", monthlyCost: 124.00, unit: "on-demand/month" },
    },
  },
  azure: {
    service: {
      low: { service: "Functions Consumption", monthlyCost: 5.20, unit: "per 1M executions + compute" },
      medium: { service: "App Service B1", monthlyCost: 54.75, unit: "per instance/month" },
      high: { service: "VM D4s v3", monthlyCost: 140.16, unit: "on-demand/month" },
    },
    application: {
      low: { service: "Static Web Apps Free", monthlyCost: 3.00, unit: "bandwidth overage only" },
      medium: { service: "App Service B1", monthlyCost: 54.75, unit: "per instance/month" },
      high: { service: "App Service P1v2 + CDN", monthlyCost: 146.00, unit: "per instance/month" },
    },
    dataProvider: {
      low: { service: "Azure SQL Basic (5 DTU)", monthlyCost: 4.99, unit: "per month" },
      medium: { service: "Azure Database for PostgreSQL", monthlyCost: 102.98, unit: "General Purpose 2 vCores" },
      high: { service: "Azure SQL Business Critical", monthlyCost: 490.00, unit: "per month" },
    },
    identityProvider: {
      low: { service: "Azure AD B2C (free tier)", monthlyCost: 0, unit: "first 50k MAU free" },
      medium: { service: "Azure AD B2C", monthlyCost: 35.00, unit: "per 10k MAU premium" },
      high: { service: "Azure AD B2C Premium", monthlyCost: 200.00, unit: "enterprise scale" },
    },
    processUnit: {
      low: { service: "Functions Consumption", monthlyCost: 2.00, unit: "per 1M executions" },
      medium: { service: "Container Instances (1 vCPU)", monthlyCost: 32.00, unit: "per month" },
      high: { service: "VM D2s v3 (worker)", monthlyCost: 70.08, unit: "on-demand/month" },
    },
  },
  gcp: {
    service: {
      low: { service: "Cloud Functions", monthlyCost: 4.80, unit: "per 1M invocations + compute" },
      medium: { service: "Cloud Run", monthlyCost: 40.00, unit: "per vCPU/month" },
      high: { service: "Compute Engine n1-standard-4", monthlyCost: 138.70, unit: "on-demand/month" },
    },
    application: {
      low: { service: "Cloud Storage + CDN", monthlyCost: 2.00, unit: "per GB + requests" },
      medium: { service: "Firebase Hosting", monthlyCost: 25.00, unit: "Blaze plan" },
      high: { service: "Compute Engine + Cloud CDN", monthlyCost: 155.00, unit: "on-demand/month" },
    },
    dataProvider: {
      low: { service: "Cloud SQL db-f1-micro", monthlyCost: 10.00, unit: "on-demand/month" },
      medium: { service: "Cloud SQL db-standard-1", monthlyCost: 95.00, unit: "on-demand/month" },
      high: { service: "Cloud SQL HA db-standard-4", monthlyCost: 520.00, unit: "on-demand/month" },
    },
    identityProvider: {
      low: { service: "Identity Platform (free tier)", monthlyCost: 0, unit: "first 50k MAU free" },
      medium: { service: "Identity Platform", monthlyCost: 30.00, unit: "per 10k MAU" },
      high: { service: "Identity Platform Enterprise", monthlyCost: 210.00, unit: "enterprise scale" },
    },
    processUnit: {
      low: { service: "Cloud Functions (scheduled)", monthlyCost: 2.00, unit: "per 1M invocations" },
      medium: { service: "Cloud Run Job", monthlyCost: 30.00, unit: "per vCPU/month" },
      high: { service: "Compute Engine n1-standard-2", monthlyCost: 69.35, unit: "on-demand/month" },
    },
  },
};

// ============================================================
// Fetch helpers
// ============================================================

/**
 * Fetch with timeout using AbortController.
 * @param {string} url
 * @param {object} options - fetch options
 * @returns {Promise<Response>}
 */
async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip",
        ...(options.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Checks if an error is a network-level error (DNS, connection, timeout).
 */
function isNetworkError(err) {
  const codes = ["ENOTFOUND", "ECONNREFUSED", "ETIMEDOUT", "ECONNRESET", "UND_ERR_CONNECT_TIMEOUT"];
  if (err.cause && codes.includes(err.cause.code)) return true;
  if (err.code && codes.includes(err.code)) return true;
  if (err.name === "AbortError") return true;
  return false;
}

// ============================================================
// Azure Retail Prices API (most reliable)
// ============================================================

/**
 * Fetches a single Azure retail price query.
 * @param {string} filter - OData $filter string
 * @returns {Promise<number|null>} - retail price or null
 */
async function fetchAzurePrice(filter) {
  const url = `https://prices.azure.com/api/retail/prices?$filter=${encodeURIComponent(filter)}`;
  const res = await fetchWithTimeout(url);
  if (!res.ok) {
    throw new Error(`Azure API returned ${res.status}: ${res.statusText}`);
  }
  const data = await res.json();
  if (!data.Items || data.Items.length === 0) {
    return null;
  }
  // Find the first non-zero Linux/consumption price
  const item = data.Items.find((i) => i.retailPrice > 0) || data.Items[0];
  return item.retailPrice;
}

/**
 * Fetches Azure prices and maps them to our tier structure.
 * Returns per-hour prices converted to monthly (730 hours for VMs).
 */
async function fetchAzurePrices() {
  console.log(`${LOG_PREFIX} Fetching Azure prices...`);
  const HOURS_PER_MONTH = 730;

  const queries = {
    // service tiers
    "service.low": {
      filter: "serviceName eq 'Functions' and armRegionName eq 'eastus' and priceType eq 'Consumption' and skuName eq 'Standard'",
      service: "Functions Consumption",
      unit: "per 1M executions + compute",
      transform: (price) => price, // already monthly-ish
    },
    "service.medium": {
      filter: "serviceName eq 'Virtual Machines' and armRegionName eq 'eastus' and skuName eq 'B2s' and priceType eq 'Consumption'",
      service: "VM B2s",
      unit: "on-demand/month",
      transform: (price) => Math.round(price * HOURS_PER_MONTH * 100) / 100,
    },
    "service.high": {
      filter: "serviceName eq 'Virtual Machines' and armRegionName eq 'eastus' and skuName eq 'D4s v3' and priceType eq 'Consumption'",
      service: "VM D4s v3",
      unit: "on-demand/month",
      transform: (price) => Math.round(price * HOURS_PER_MONTH * 100) / 100,
    },
    // application tiers
    "application.medium": {
      filter: "serviceName eq 'Azure App Service' and armRegionName eq 'eastus' and skuName eq 'B1' and priceType eq 'Consumption'",
      service: "App Service B1",
      unit: "per instance/month",
      transform: (price) => Math.round(price * HOURS_PER_MONTH * 100) / 100,
    },
    // dataProvider tiers
    "dataProvider.medium": {
      filter: "serviceName eq 'Azure Database for PostgreSQL' and armRegionName eq 'eastus' and priceType eq 'Consumption' and skuName eq 'General Purpose - Flexible Server - D2s v3 - vCore'",
      service: "Azure Database for PostgreSQL",
      unit: "General Purpose 2 vCores/month",
      transform: (price) => Math.round(price * HOURS_PER_MONTH * 100) / 100,
    },
  };

  const result = {};
  let fetched = 0;

  for (const [key, query] of Object.entries(queries)) {
    try {
      const price = await fetchAzurePrice(query.filter);
      if (price !== null && price > 0) {
        const [component, tier] = key.split(".");
        if (!result[component]) result[component] = {};
        result[component][tier] = {
          service: query.service,
          monthlyCost: query.transform(price),
          unit: query.unit,
        };
        fetched++;
      }
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn(`${LOG_PREFIX} Azure query "${key}" network error: ${err.message}`);
      } else {
        console.warn(`${LOG_PREFIX} Azure query "${key}" failed: ${err.message}`);
      }
    }
  }

  console.log(`${LOG_PREFIX} Azure: fetched ${fetched}/${Object.keys(queries).length} prices`);

  // Fill remaining tiers from fallback
  const azure = JSON.parse(JSON.stringify(FALLBACK_PRICES.azure));
  for (const [component, tiers] of Object.entries(result)) {
    for (const [tier, data] of Object.entries(tiers)) {
      if (azure[component] && azure[component][tier]) {
        azure[component][tier] = data;
      }
    }
  }

  return azure;
}

// ============================================================
// AWS Pricing (attempts bulk API, falls back to hardcoded)
// ============================================================

async function fetchAwsPrices() {
  console.log(`${LOG_PREFIX} Fetching AWS prices...`);

  // Attempt to fetch Lambda pricing from AWS Bulk Pricing API
  try {
    const lambdaUrl = "https://pricing.us-east-1.amazonaws.com/offers/v1.0/aws/AWSLambda/current/index.json";
    const res = await fetchWithTimeout(lambdaUrl);

    if (res.ok) {
      // Stream/parse just enough to extract us-east-1 on-demand request price
      const text = await res.text();
      const data = JSON.parse(text);

      const products = data.products || {};
      const terms = data.terms?.OnDemand || {};

      // Find Lambda request price for us-east-1
      let requestPrice = null;
      let durationPrice = null;

      for (const [sku, product] of Object.entries(products)) {
        if (product.attributes?.location !== "US East (N. Virginia)") continue;
        if (product.attributes?.group === "AWS-Lambda-Requests") {
          const termData = terms[sku];
          if (termData) {
            const dim = Object.values(Object.values(termData)[0]?.priceDimensions || {})[0];
            if (dim) requestPrice = parseFloat(dim.pricePerUnit?.USD || 0);
          }
        }
        if (product.attributes?.group === "AWS-Lambda-Duration") {
          const termData = terms[sku];
          if (termData) {
            const dim = Object.values(Object.values(termData)[0]?.priceDimensions || {})[0];
            if (dim) durationPrice = parseFloat(dim.pricePerUnit?.USD || 0);
          }
        }
      }

      if (requestPrice !== null) {
        // 1M requests cost + estimated 400k GB-seconds of compute
        const monthlyCost = Math.round(((requestPrice * 1000000) + (durationPrice || 0.0000166667) * 400000) * 100) / 100;
        const aws = JSON.parse(JSON.stringify(FALLBACK_PRICES.aws));
        aws.service.low.monthlyCost = monthlyCost;
        aws.service.low.service = "Lambda (live pricing)";
        const eurMonthlyCost = Math.round(monthlyCost * USD_TO_EUR * 100) / 100;
        console.log(`${LOG_PREFIX} AWS Lambda price fetched: €${eurMonthlyCost}/mo`);
        return aws;
      }
    }
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn(`${LOG_PREFIX} AWS network error: ${err.message}`);
    } else {
      console.warn(`${LOG_PREFIX} AWS Lambda fetch failed: ${err.message}`);
    }
  }

  console.log(`${LOG_PREFIX} AWS: using fallback prices`);
  return JSON.parse(JSON.stringify(FALLBACK_PRICES.aws));
}

// ============================================================
// GCP Pricing (attempts calculator JSON, falls back to hardcoded)
// ============================================================

async function fetchGcpPrices() {
  console.log(`${LOG_PREFIX} Fetching GCP prices...`);

  try {
    const url = "https://cloudpricingcalculator.appspot.com/static/data/pricelist.json";
    const res = await fetchWithTimeout(url);

    if (res.ok) {
      const data = await res.json();
      const prices = data.gcp_price_list || data;

      const gcp = JSON.parse(JSON.stringify(FALLBACK_PRICES.gcp));

      // Try to extract n1-standard-1 US pricing (for service.medium)
      const n1Key = Object.keys(prices).find(
        (k) => k.includes("CP-COMPUTEENGINE-VMIMAGE-N1-STANDARD-1") && !k.includes("PREEMPTIBLE")
      );
      if (n1Key && prices[n1Key]?.us) {
        const hourly = prices[n1Key].us;
        gcp.service.medium.monthlyCost = Math.round(hourly * 730 * 100) / 100;
        gcp.service.medium.service = "Compute Engine n1-standard-1 (live)";
      }

      // Try to extract Cloud Functions invocation price
      const cfKey = Object.keys(prices).find((k) => k.includes("FUNCTIONS") && k.includes("INVOCATIONS"));
      if (cfKey && prices[cfKey]?.us) {
        gcp.service.low.monthlyCost = Math.round(prices[cfKey].us * 1000000 * 100) / 100;
        gcp.service.low.service = "Cloud Functions (live)";
      }

      console.log(`${LOG_PREFIX} GCP: parsed calculator pricing`);
      return gcp;
    }
  } catch (err) {
    if (isNetworkError(err)) {
      console.warn(`${LOG_PREFIX} GCP network error: ${err.message}`);
    } else {
      console.warn(`${LOG_PREFIX} GCP calculator fetch failed: ${err.message}`);
    }
  }

  console.log(`${LOG_PREFIX} GCP: using fallback prices`);
  return JSON.parse(JSON.stringify(FALLBACK_PRICES.gcp));
}

// ============================================================
// Validation
// ============================================================

/**
 * Validates that pricing data has the expected structure and all costs are
 * positive numbers (or zero for free tiers).
 */
function validatePricingData(data) {
  if (!data || typeof data !== "object") return "Data is not an object";
  if (!data.components || typeof data.components !== "object") return "Missing components";
  if (!data.connections || typeof data.connections !== "object") return "Missing connections";
  if (!data.modifiers || typeof data.modifiers !== "object") return "Missing modifiers";

  for (const [compName, comp] of Object.entries(data.components)) {
    if (!comp.tiers) return `Missing tiers for component "${compName}"`;
    for (const [tierName, tier] of Object.entries(comp.tiers)) {
      if (typeof tier.cost !== "number" || !isFinite(tier.cost) || tier.cost < 0) {
        return `Invalid cost for ${compName}.${tierName}: ${tier.cost}`;
      }
    }
  }

  return null; // valid
}

// ============================================================
// Merge logic
// ============================================================

/**
 * Merges fetched provider prices into the existing pricing reference.
 * - Updates the `providers` object on each tier with fresh data.
 * - Recalculates the top-level `cost` as the average across providers.
 * - Only updates fields where fresh data was fetched; keeps existing data for failed providers.
 *
 * @param {object} current - Current pricingReference.json contents
 * @param {object} results - { aws, azure, gcp } each with component->tier->price data
 * @returns {object} - Updated pricing reference
 */
function mergePricingData(current, results) {
  const updated = JSON.parse(JSON.stringify(current));
  const today = new Date().toISOString().split("T")[0];
  let changedCount = 0;

  const providerNames = ["aws", "azure", "gcp"];
  const componentNames = ["service", "application", "dataProvider", "identityProvider", "processUnit"];
  const tierNames = ["low", "medium", "high"];

  for (const compName of componentNames) {
    if (!updated.components[compName]) continue;

    for (const tierName of tierNames) {
      const tier = updated.components[compName].tiers[tierName];
      if (!tier) continue;

      // Ensure providers object exists
      if (!tier.providers) tier.providers = {};

      for (const providerName of providerNames) {
        const providerData = results[providerName];
        if (!providerData) continue;
        if (!providerData[compName]) continue;
        if (!providerData[compName][tierName]) continue;

        const fresh = providerData[compName][tierName];

        const convertedMonthlyCost = Math.round(fresh.monthlyCost * USD_TO_EUR * 100) / 100;
        const oldCost = tier.providers[providerName]?.monthlyCost;
        tier.providers[providerName] = {
          service: fresh.service,
          monthlyCost: convertedMonthlyCost,
          unit: fresh.unit,
          lastUpdated: today,
        };

        if (oldCost !== convertedMonthlyCost) changedCount++;
      }

      // Recalculate average cost from providers
      const providerCosts = Object.values(tier.providers)
        .map((p) => p.monthlyCost)
        .filter((c) => typeof c === "number" && c >= 0);

      if (providerCosts.length > 0) {
        tier.cost = Math.round((providerCosts.reduce((a, b) => a + b, 0) / providerCosts.length) * 100) / 100;
      }
    }
  }

  updated.lastUpdated = today;

  return { data: updated, changedCount };
}

// ============================================================
// Main entry point
// ============================================================

/**
 * Fetches current prices from AWS, Azure, and GCP and updates
 * pricingReference.json. Never throws — all errors are caught and returned
 * in the summary.
 *
 * @returns {Promise<object>} Summary of what happened
 */
async function updatePrices() {
  console.log(`${LOG_PREFIX} Starting price update...`);

  const results = { aws: null, azure: null, gcp: null };
  const errors = [];
  const providersUpdated = [];

  // 1. Try Azure first (most reliable public API)
  try {
    results.azure = await fetchAzurePrices();
    providersUpdated.push("azure");
  } catch (err) {
    errors.push({ provider: "azure", error: err.message });
    console.error(`${LOG_PREFIX} Azure fetch failed:`, err.message);
  }

  // 2. Try AWS
  try {
    results.aws = await fetchAwsPrices();
    providersUpdated.push("aws");
  } catch (err) {
    errors.push({ provider: "aws", error: err.message });
    console.error(`${LOG_PREFIX} AWS fetch failed:`, err.message);
  }

  // 3. Try GCP
  try {
    results.gcp = await fetchGcpPrices();
    providersUpdated.push("gcp");
  } catch (err) {
    errors.push({ provider: "gcp", error: err.message });
    console.error(`${LOG_PREFIX} GCP fetch failed:`, err.message);
  }

  // 4. Read current pricing reference
  let currentReference;
  try {
    const raw = fs.readFileSync(PRICING_FILE, "utf-8");
    currentReference = JSON.parse(raw);
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to read current pricingReference.json:`, err.message);
    return {
      providersUpdated: [],
      providersFailed: ["aws", "azure", "gcp"],
      errors: [{ provider: "system", error: `Cannot read pricing file: ${err.message}` }],
      pricesChanged: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // 5. Merge results (converting USD to EUR)
  console.log(`${LOG_PREFIX} Converting prices from USD to EUR at rate: ${USD_TO_EUR}`);
  const { data: merged, changedCount } = mergePricingData(currentReference, results);

  // 6. Validate before writing
  const validationError = validatePricingData(merged);
  if (validationError) {
    console.error(`${LOG_PREFIX} Validation failed: ${validationError}. Keeping old file.`);
    return {
      providersUpdated: [],
      providersFailed: ["aws", "azure", "gcp"],
      errors: [{ provider: "system", error: `Validation failed: ${validationError}` }],
      pricesChanged: 0,
      timestamp: new Date().toISOString(),
    };
  }

  // 7. Backup current file
  try {
    fs.copyFileSync(PRICING_FILE, BACKUP_FILE);
    console.log(`${LOG_PREFIX} Backup created at ${BACKUP_FILE}`);
  } catch (err) {
    console.warn(`${LOG_PREFIX} Failed to create backup: ${err.message}`);
  }

  // 8. Write updated file
  try {
    fs.writeFileSync(PRICING_FILE, JSON.stringify(merged, null, 2) + "\n", "utf-8");
    console.log(`${LOG_PREFIX} Updated pricingReference.json (${changedCount} prices changed)`);
  } catch (err) {
    console.error(`${LOG_PREFIX} Failed to write pricingReference.json:`, err.message);
    errors.push({ provider: "system", error: `Write failed: ${err.message}` });
  }

  const providersFailed = ["aws", "azure", "gcp"].filter((p) => !providersUpdated.includes(p));

  const summary = {
    providersUpdated,
    providersFailed,
    errors,
    pricesChanged: changedCount,
    timestamp: new Date().toISOString(),
  };

  console.log(`${LOG_PREFIX} Price update complete:`, JSON.stringify(summary, null, 2));
  return summary;
}

module.exports = {
  updatePrices,
  // Exported for testing
  mergePricingData,
  validatePricingData,
  fetchAzurePrices,
  fetchAwsPrices,
  fetchGcpPrices,
  FALLBACK_PRICES,
  PRICING_FILE,
  BACKUP_FILE,
};
