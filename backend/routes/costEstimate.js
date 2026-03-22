// backend/routes/costEstimate.js

const express = require("express");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const { parseDiagram } = require("../common/diagramParser");
const { estimateCost, estimateCostWithUsage } = require("../common/costEstimator");
const pricingReference = require("../common/pricingReference.json");
const { updatePrices } = require("../jobs/priceFetcher");

const PRICING_FILE = path.join(__dirname, "..", "common", "pricingReference.json");

/**
 * POST /estimate
 * Takes a JSON-LD diagram and returns a cost breakdown.
 */
router.post("/estimate", async (req, res) => {
  try {
    let diagram = req.body?.diagram;

    // Handle empty request body
    if (!req.body || Object.keys(req.body).length === 0) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid diagram. Expected a JSON-LD object with @context and @graph.",
      });
    }

    // Handle stringified JSON
    if (typeof diagram === "string") {
      try {
        diagram = JSON.parse(diagram);
      } catch (parseErr) {
        return res.status(400).json({
          success: false,
          error: "Missing or invalid diagram. Expected a JSON-LD object with @context and @graph.",
        });
      }
    }

    // Validate diagram exists and has @graph
    if (!diagram || typeof diagram !== "object" || !diagram["@graph"]) {
      return res.status(400).json({
        success: false,
        error: "Missing or invalid diagram. Expected a JSON-LD object with @context and @graph.",
      });
    }

    // Parse the diagram
    let parsedResult;
    try {
      parsedResult = parseDiagram(diagram);
    } catch (parseErr) {
      return res.status(400).json({
        success: false,
        error: `Failed to parse diagram: ${parseErr.message}`,
      });
    }

    // Check if usage overrides are provided
    const usageOverrides = req.body?.usageOverrides;
    const hasUsageOverrides =
      usageOverrides &&
      typeof usageOverrides === "object" &&
      ((usageOverrides.components && Object.keys(usageOverrides.components).length > 0) ||
        (usageOverrides.connections && Object.keys(usageOverrides.connections).length > 0));

    // Estimate costs
    let costResult;
    try {
      if (hasUsageOverrides) {
        costResult = estimateCostWithUsage(parsedResult, pricingReference, usageOverrides);
      } else {
        costResult = estimateCost(parsedResult, pricingReference);
      }
    } catch (estimateErr) {
      return res.status(500).json({
        success: false,
        error: `Failed to estimate cost: ${estimateErr.message}`,
      });
    }

    // Check if estimateCost returned errors
    if (costResult.errors && costResult.errors.length > 0) {
      return res.status(500).json({
        success: false,
        error: `Failed to estimate cost: ${costResult.errors.join(", ")}`,
      });
    }

    return res.json({
      success: true,
      data: {
        totalEstimate: costResult.totalEstimate,
        componentBreakdown: costResult.componentBreakdown,
        connectionBreakdown: costResult.connectionBreakdown,
        modifierBreakdown: costResult.modifierBreakdown,
        metadata: costResult.metadata,
      },
    });
  } catch (err) {
    console.error("Cost estimate error:", err?.message || err);
    return res.status(500).json({
      success: false,
      error: `Failed to estimate cost: ${err?.message || "Unknown error"}`,
    });
  }
});

/**
 * GET /usage-fields
 * Returns the usage field definitions so the frontend knows what inputs to show per component/connection type.
 */
router.get("/usage-fields", (req, res) => {
  try {
    const usageFieldsPath = path.join(__dirname, "..", "common", "usageFields.json");
    const raw = fs.readFileSync(usageFieldsPath, "utf-8");
    const usageFields = JSON.parse(raw);
    return res.json({
      success: true,
      data: usageFields,
    });
  } catch (err) {
    console.error("Failed to read usage fields:", err.message);
    return res.status(500).json({
      success: false,
      error: "Failed to load usage field definitions",
    });
  }
});

/**
 * GET /pricing
 * Returns the current pricing reference for frontend display.
 * Reads fresh from disk so it reflects any updates from the price fetcher.
 */
router.get("/pricing", (req, res) => {
  try {
    const raw = fs.readFileSync(PRICING_FILE, "utf-8");
    const freshPricing = JSON.parse(raw);
    return res.json({
      success: true,
      data: freshPricing,
    });
  } catch (err) {
    // Fall back to cached require'd version if disk read fails
    console.error("Failed to read fresh pricing file:", err.message);
    return res.json({
      success: true,
      data: pricingReference,
    });
  }
});

/**
 * POST /update-prices
 * Manually triggers a price update from cloud providers.
 */
router.post("/update-prices", async (req, res) => {
  try {
    const summary = await updatePrices();
    return res.json({
      success: true,
      data: summary,
    });
  } catch (err) {
    console.error("Price update error:", err?.message || err);
    return res.status(500).json({
      success: false,
      error: `Price update failed: ${err?.message || "Unknown error"}`,
    });
  }
});

module.exports = router;
