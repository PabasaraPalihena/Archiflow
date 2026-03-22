/**
 * Cost estimation utility for WAM diagrams.
 * Takes parsed diagram output and pricing reference to produce cost breakdowns.
 */

const FALLBACK_TIER_COSTS = { small: 9.20, production: 46.00, enterprise: 184.00 };

/**
 * Rounds a number to 2 decimal places
 * @param {number} value - The value to round
 * @returns {number} - Rounded value
 */
function round(value) {
  return Math.round(value * 100) / 100;
}

/**
 * Gets tier costs for a component type from the pricing reference
 * @param {string} type - Component type (e.g., "service", "application")
 * @param {Object} pricingReference - The pricing reference object
 * @returns {Object} - { tierCosts, warnings, modifiers }
 */
function getComponentPricing(type, pricingReference) {
  const componentPricing = pricingReference.components[type];
  const warnings = [];

  if (!componentPricing) {
    warnings.push(`Unknown component type "${type}", using fallback pricing`);
    return {
      tierCosts: { ...FALLBACK_TIER_COSTS },
      modifiers: {},
      warnings,
    };
  }

  const tierCosts = {
    small: componentPricing.tiers.small.cost,
    production: componentPricing.tiers.production.cost,
    enterprise: componentPricing.tiers.enterprise.cost,
  };

  return {
    tierCosts,
    modifiers: componentPricing.modifiers || {},
    warnings,
  };
}

/**
 * Applies component modifiers to tier costs
 * @param {Object} tierCosts - Base tier costs { small, production, enterprise }
 * @param {Object} componentProperties - Properties from the parsed component
 * @param {Object} modifiers - Modifiers from pricing reference
 * @returns {Object} - { adjustedCosts, appliedModifiers }
 */
function applyComponentModifiers(tierCosts, componentProperties, modifiers) {
  const appliedModifiers = [];
  let multiplier = 1.0;

  for (const [modifierKey, modifierValues] of Object.entries(modifiers)) {
    const propertyValue = componentProperties[modifierKey];
    if (propertyValue && modifierValues[propertyValue] !== undefined) {
      const modValue = modifierValues[propertyValue];
      multiplier *= modValue;
      appliedModifiers.push(`${modifierKey}:${propertyValue} (${modValue}x)`);
    }
  }

  const adjustedCosts = {
    small: round(tierCosts.small * multiplier),
    production: round(tierCosts.production * multiplier),
    enterprise: round(tierCosts.enterprise * multiplier),
  };

  return { adjustedCosts, appliedModifiers };
}

/**
 * Gets cost for a connection type from the pricing reference
 * @param {string} type - Connection type (e.g., "invocation", "trust")
 * @param {Object} connectionProperties - Properties from the parsed connection
 * @param {Object} pricingReference - The pricing reference object
 * @returns {Object} - { cost, warnings }
 */
function getConnectionCost(type, connectionProperties, pricingReference) {
  const connectionPricing = pricingReference.connections[type];
  const warnings = [];

  if (!connectionPricing) {
    warnings.push(`Unknown connection type "${type}", using zero cost`);
    return { cost: 0, warnings };
  }

  let cost = connectionPricing.baseCost || 0;

  // Add protocol-specific cost if applicable
  if (connectionPricing.protocolCosts && connectionProperties.protocol) {
    const protocolCost = connectionPricing.protocolCosts[connectionProperties.protocol];
    if (protocolCost !== undefined) {
      cost += protocolCost;
    }
  }

  return { cost: round(cost), warnings };
}

/**
 * Computes diagram-wide modifiers
 * @param {Object} parsedDiagram - Parsed diagram from diagramParser
 * @param {Object} pricingReference - The pricing reference object
 * @returns {Array} - Array of modifier breakdown objects
 */
function computeModifiers(parsedDiagram, pricingReference) {
  const modifierBreakdown = [];
  const { summary, components, connections } = parsedDiagram;
  const modifierPricing = pricingReference.modifiers;

  // Encryption modifier
  const hasEncryption = summary.hasEncryption;
  const encryptedCount = connections.filter(
    (c) => c.properties.encrypted === true || c.properties.encrypted === "true"
  ).length;

  modifierBreakdown.push({
    modifier: "encryption",
    applied: hasEncryption,
    cost: hasEncryption ? modifierPricing.encryption.cost : 0,
    reason: hasEncryption
      ? `TLS detected on ${encryptedCount} connection${encryptedCount !== 1 ? "s" : ""}`
      : "No encrypted connections detected",
  });

  // Public-facing modifier
  const hasPublicFacing = summary.hasPublicFacing;
  const publicFacingCount = components.filter(
    (c) => c.properties.publicFacing === true || c.properties.publicFacing === "true"
  ).length;

  modifierBreakdown.push({
    modifier: "publicFacing",
    applied: hasPublicFacing,
    cost: hasPublicFacing ? modifierPricing.publicFacing.cost : 0,
    reason: hasPublicFacing
      ? `${publicFacingCount} public-facing component${publicFacingCount !== 1 ? "s" : ""} detected`
      : "No public-facing components detected",
  });

  // Cross-realm modifier
  const securityRealmCount = summary.componentCounts.securityRealm || 0;
  const trustConnections = connections.filter((c) => c.type === "trust");
  const hasCrossRealm = securityRealmCount > 1 && trustConnections.length > 0;
  const crossRealmPairs = hasCrossRealm ? trustConnections.length : 0;

  modifierBreakdown.push({
    modifier: "crossRealm",
    applied: hasCrossRealm,
    cost: hasCrossRealm ? round(modifierPricing.crossRealm.cost * crossRealmPairs) : 0,
    reason: hasCrossRealm
      ? `${crossRealmPairs} cross-realm trust connection${crossRealmPairs !== 1 ? "s" : ""} detected`
      : "No cross-realm invocations detected",
  });

  return modifierBreakdown;
}

/**
 * Main function to estimate costs for a parsed WAM diagram
 * @param {Object} parsedDiagram - Output from parseDiagram() in diagramParser.js
 * @param {Object} pricingReference - Parsed JSON from pricingReference.json
 * @returns {Object} - Cost estimation result with breakdowns
 */
function estimateCost(parsedDiagram, pricingReference) {
  const errors = [];
  const warnings = [];

  try {
    // Validate inputs
    if (!parsedDiagram) {
      throw new Error("parsedDiagram is required");
    }
    if (!pricingReference) {
      throw new Error("pricingReference is required");
    }

    const { components, connections, summary } = parsedDiagram;

    // Initialize totals
    const totalEstimate = { small: 0, production: 0, enterprise: 0 };
    const componentBreakdown = [];
    const connectionBreakdown = [];

    // Process components
    for (const component of components) {
      const { tierCosts, modifiers, warnings: compWarnings } = getComponentPricing(
        component.type,
        pricingReference
      );
      warnings.push(...compWarnings);

      const { adjustedCosts, appliedModifiers } = applyComponentModifiers(
        tierCosts,
        component.properties,
        modifiers
      );

      componentBreakdown.push({
        id: component.id,
        label: component.label,
        type: component.type,
        tierCosts: adjustedCosts,
        appliedModifiers,
        defaultEstimate: adjustedCosts.production,
      });

      totalEstimate.small += adjustedCosts.small;
      totalEstimate.production += adjustedCosts.production;
      totalEstimate.enterprise += adjustedCosts.enterprise;
    }

    // Process connections
    for (const connection of connections) {
      const { cost, warnings: connWarnings } = getConnectionCost(
        connection.type,
        connection.properties,
        pricingReference
      );
      warnings.push(...connWarnings);

      connectionBreakdown.push({
        id: connection.id,
        type: connection.type,
        from: connection.from,
        to: connection.to,
        cost,
      });

      // Connection costs are the same for all tiers
      totalEstimate.small += cost;
      totalEstimate.production += cost;
      totalEstimate.enterprise += cost;
    }

    // Compute diagram-wide modifiers
    const modifierBreakdown = computeModifiers(parsedDiagram, pricingReference);

    // Add modifier costs to totals
    for (const modifier of modifierBreakdown) {
      totalEstimate.small += modifier.cost;
      totalEstimate.production += modifier.cost;
      totalEstimate.enterprise += modifier.cost;
    }

    // Round totals
    totalEstimate.small = round(totalEstimate.small);
    totalEstimate.production = round(totalEstimate.production);
    totalEstimate.enterprise = round(totalEstimate.enterprise);

    // Build result
    const result = {
      totalEstimate,
      componentBreakdown,
      connectionBreakdown,
      modifierBreakdown,
      metadata: {
        diagramComponentCount: summary.totalComponents,
        diagramConnectionCount: summary.totalConnections,
        estimatedAt: new Date().toISOString(),
        pricingVersion: pricingReference.version,
        currency: pricingReference.currency,
        billingPeriod: pricingReference.billingPeriod,
      },
    };

    // Add warnings if any
    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  } catch (error) {
    // Return partial result with errors
    return {
      totalEstimate: { small: 0, production: 0, enterprise: 0 },
      componentBreakdown: [],
      connectionBreakdown: [],
      modifierBreakdown: [],
      metadata: {
        diagramComponentCount: 0,
        diagramConnectionCount: 0,
        estimatedAt: new Date().toISOString(),
        pricingVersion: pricingReference?.version || "unknown",
        currency: pricingReference?.currency || "EUR",
        billingPeriod: pricingReference?.billingPeriod || "monthly",
      },
      errors: [error.message],
    };
  }
}

/**
 * Merges user overrides with defaults for a given type
 * @param {string} category - "components" or "connections"
 * @param {string} type - Component/connection type
 * @param {Object} overrides - User-provided overrides (may be partial)
 * @param {Object} usageFields - The usageFields reference
 * @returns {Object} - Merged values with defaults filled in
 */
function mergeWithDefaults(category, type, overrides, usageFields) {
  const typeFields = usageFields[category]?.[type]?.fields;
  if (!typeFields) return overrides || {};

  const merged = {};
  for (const field of typeFields) {
    if (overrides && overrides[field.key] !== undefined) {
      // Clamp negative numbers to 0 for numeric fields
      const val = overrides[field.key];
      if (field.type === "number" && typeof val === "number" && val < 0) {
        merged[field.key] = 0;
      } else {
        merged[field.key] = val;
      }
    } else {
      merged[field.key] = field.default;
    }
  }
  return merged;
}

/**
 * Computes usage-based cost for a service component
 * @param {Object} usage - Merged usage values
 * @param {Object} unitPrices - Unit prices from pricingReference
 * @param {Object} tierCosts - Tier costs from pricingReference for this type
 * @returns {{ cost: number, details: string }}
 */
function computeServiceCost(usage, unitPrices, tierCosts) {
  const { requestsPerMonth, avgResponseTimeMs, memoryMB, instanceCount } = usage;
  const sp = unitPrices.service.serverless;

  // Serverless path: when instanceCount is 1 (default)
  if (instanceCount <= 1) {
    const requestCost = (requestsPerMonth / 1000000) * sp.pricePerMillionRequests;
    const computeSeconds = (requestsPerMonth * avgResponseTimeMs) / 1000;
    const gbSeconds = computeSeconds * (memoryMB / 1024);
    const computeCost = gbSeconds * sp.pricePerGBSecond;
    const total = round(requestCost + computeCost);
    const details = `${(requestsPerMonth / 1000).toFixed(0)}K requests × €${sp.pricePerMillionRequests}/1M = €${round(requestCost)} + ${(requestsPerMonth / 1000).toFixed(0)}K × ${avgResponseTimeMs}ms × ${memoryMB}MB × €${sp.pricePerGBSecond}/GB-s = €${round(computeCost)}. Total: €${total}`;
    return { cost: total, details };
  }

  // Container/VM path: when instanceCount > 1
  const perInstance = tierCosts.production;
  const total = round(instanceCount * perInstance);
  const details = `${instanceCount} instances × €${round(perInstance)}/instance = €${total}`;
  return { cost: total, details };
}

/**
 * Computes usage-based cost for an application component
 * @param {Object} usage - Merged usage values
 * @param {Object} unitPrices - Unit prices from pricingReference
 * @param {Object} tierCosts - Tier costs from pricingReference for this type
 * @returns {{ cost: number, details: string }}
 */
function computeApplicationCost(usage, unitPrices, tierCosts) {
  const { bandwidthGB, storageGB } = usage;
  const ap = unitPrices.application;
  const baseCost = tierCosts.small;
  const bwCost = bandwidthGB * ap.bandwidthPerGB;
  const storageCost = storageGB * ap.storagePerGB;
  const total = round(baseCost + bwCost + storageCost);
  const details = `Base hosting: €${round(baseCost)} + ${bandwidthGB}GB bandwidth × €${ap.bandwidthPerGB}/GB = €${round(bwCost)} + ${storageGB}GB storage × €${ap.storagePerGB}/GB = €${round(storageCost)}. Total: €${total}`;
  return { cost: total, details };
}

/**
 * Computes usage-based cost for a dataProvider component
 * @param {Object} usage - Merged usage values
 * @param {Object} unitPrices - Unit prices from pricingReference
 * @param {Object} tierCosts - Tier costs from pricingReference for this type
 * @returns {{ cost: number, details: string }}
 */
function computeDataProviderCost(usage, unitPrices, tierCosts) {
  const { storageGB, backupEnabled, multiAZ } = usage;
  const dp = unitPrices.dataProvider;
  const baseCost = tierCosts.production;
  const storageCost = storageGB * dp.storagePerGB;
  const backupCost = backupEnabled ? storageGB * dp.backupPerGB : 0;
  const multiAZCost = multiAZ ? baseCost : 0;
  const total = round(baseCost + storageCost + backupCost + multiAZCost);

  const parts = [`Base: €${round(baseCost)}`, `${storageGB}GB × €${dp.storagePerGB}/GB = €${round(storageCost)}`];
  if (backupEnabled) parts.push(`Backup: ${storageGB}GB × €${dp.backupPerGB}/GB = €${round(backupCost)}`);
  if (multiAZ) parts.push(`Multi-AZ: +€${round(multiAZCost)}`);
  const details = parts.join(" + ") + `. Total: €${total}`;
  return { cost: total, details };
}

/**
 * Computes usage-based cost for an identityProvider component
 * @param {Object} usage - Merged usage values
 * @param {Object} unitPrices - Unit prices from pricingReference
 * @returns {{ cost: number, details: string }}
 */
function computeIdentityProviderCost(usage, unitPrices) {
  const { monthlyActiveUsers, mfaEnabled } = usage;
  const ip = unitPrices.identityProvider;
  const billableMAUs = Math.max(0, monthlyActiveUsers - ip.freeMAUs);
  const mauCost = billableMAUs * ip.pricePerMAU;
  const mfaCost = mfaEnabled ? monthlyActiveUsers * ip.mfaPerMAU : 0;
  const total = round(mauCost + mfaCost);

  const parts = [];
  if (monthlyActiveUsers <= ip.freeMAUs) {
    parts.push(`${monthlyActiveUsers} MAUs within free tier (${ip.freeMAUs} free)`);
  } else {
    parts.push(`${billableMAUs} billable MAUs × €${ip.pricePerMAU}/MAU = €${round(mauCost)}`);
  }
  if (mfaEnabled) parts.push(`MFA: ${monthlyActiveUsers} MAUs × €${ip.mfaPerMAU}/MAU = €${round(mfaCost)}`);
  const details = parts.join(" + ") + `. Total: €${total}`;
  return { cost: total, details };
}

/**
 * Computes usage-based cost for a processUnit component
 * @param {Object} usage - Merged usage values
 * @param {Object} unitPrices - Unit prices from pricingReference
 * @returns {{ cost: number, details: string }}
 */
function computeProcessUnitCost(usage, unitPrices) {
  const { computeHoursPerMonth, memoryGB, cpuCores, alwaysRunning } = usage;
  const pu = unitPrices.processUnit;

  if (alwaysRunning) {
    const cpuCost = cpuCores * pu.pricePerVCPUHour * pu.hoursPerMonth;
    const memCost = memoryGB * pu.pricePerGBHour * pu.hoursPerMonth;
    const total = round(cpuCost + memCost);
    const details = `Always-on: ${cpuCores} vCPU × €${pu.pricePerVCPUHour}/hr × ${pu.hoursPerMonth}h = €${round(cpuCost)} + ${memoryGB}GB × €${pu.pricePerGBHour}/hr × ${pu.hoursPerMonth}h = €${round(memCost)}. Total: €${total}`;
    return { cost: total, details };
  }

  const hourlyRate = cpuCores * pu.pricePerVCPUHour + memoryGB * pu.pricePerGBHour;
  const total = round(computeHoursPerMonth * hourlyRate);
  const details = `Scheduled: ${computeHoursPerMonth}h × (${cpuCores} vCPU × €${pu.pricePerVCPUHour} + ${memoryGB}GB × €${pu.pricePerGBHour}) = €${total}`;
  return { cost: total, details };
}

/**
 * Computes usage-based cost for a user-defined AI component
 * (aiApplication, aiService, aiProcess, dataset)
 * @param {Object} usage - Merged usage values
 * @returns {{ cost: number, details: string }}
 */
function computeUserDefinedCost(usage) {
  const { monthlyCost } = usage;
  const total = round(monthlyCost || 0);
  const details = total > 0
    ? `User-defined cost: €${total}/month`
    : "No cost set — enter your expected monthly cost";
  return { cost: total, details };
}

/**
 * Computes usage-based cost for a securityRealm component
 * @param {Object} usage - Merged usage values
 * @param {Object} unitPrices - Unit prices from pricingReference
 * @returns {{ cost: number, details: string }}
 */
function computeSecurityRealmCost(usage, unitPrices) {
  const { dedicatedVPC, networkPeering } = usage;
  const sr = unitPrices.securityRealm;
  const vpcCost = dedicatedVPC ? sr.vpcCost : 0;
  const peeringCost = networkPeering ? sr.peeringCostPerConnection : 0;
  const total = round(vpcCost + peeringCost);

  const parts = [];
  if (dedicatedVPC) parts.push(`VPC: €${sr.vpcCost}`);
  if (networkPeering) parts.push(`Peering: €${sr.peeringCostPerConnection}`);
  if (parts.length === 0) parts.push("No dedicated infrastructure");
  const details = parts.join(" + ") + `. Total: €${total}`;
  return { cost: total, details };
}

/**
 * Computes usage-based cost for an invocation connection
 * @param {Object} usage - Merged usage values
 * @param {Object} unitPrices - Unit prices from pricingReference
 * @returns {{ cost: number, details: string }}
 */
function computeInvocationCost(usage, unitPrices) {
  const { requestsPerMonth, avgPayloadKB, needsApiGateway } = usage;
  const cp = unitPrices.connections.invocation;
  const dataTransferGB = (requestsPerMonth * avgPayloadKB) / 1048576;
  const transferCost = dataTransferGB * cp.dataTransferPerGB;
  let gatewayCost = 0;
  if (needsApiGateway) {
    gatewayCost = cp.apiGatewayBaseCost + (requestsPerMonth / 1000000) * cp.apiGatewayPerMillion;
  }
  const total = round(transferCost + gatewayCost);

  const parts = [`${round(dataTransferGB)}GB transfer × €${cp.dataTransferPerGB}/GB = €${round(transferCost)}`];
  if (needsApiGateway) {
    parts.push(`API Gateway: €${cp.apiGatewayBaseCost} base + ${(requestsPerMonth / 1000000).toFixed(2)}M × €${cp.apiGatewayPerMillion} = €${round(gatewayCost)}`);
  }
  const details = parts.join(" + ") + `. Total: €${total}`;
  return { cost: total, details };
}

/**
 * Computes usage-based cost for a trust connection
 * @param {Object} usage - Merged usage values
 * @param {Object} unitPrices - Unit prices from pricingReference
 * @returns {{ cost: number, details: string }}
 */
function computeTrustCost(usage, unitPrices) {
  const { certificateManaged } = usage;
  const tp = unitPrices.connections.trust;
  const certCost = certificateManaged ? tp.managedCertCost : 0;
  const total = round(certCost + tp.federationBaseCost);
  const details = `${certificateManaged ? "Managed cert" : "Self-signed"}: €${certCost} + federation: €${tp.federationBaseCost}. Total: €${total}`;
  return { cost: total, details };
}

/**
 * Computes usage-based cost for a legacy connection
 * @param {Object} usage - Merged usage values
 * @param {Object} unitPrices - Unit prices from pricingReference
 * @returns {{ cost: number, details: string }}
 */
function computeLegacyConnectionCost(usage, unitPrices) {
  const { adapterRequired, dataVolumeGB } = usage;
  const lp = unitPrices.connections.legacyConnection;
  const adapterCost = adapterRequired ? lp.adapterBaseCost : 0;
  const transferCost = dataVolumeGB * lp.transferPricePerGB;
  const total = round(adapterCost + transferCost);
  const details = `${adapterRequired ? "Adapter" : "No adapter"}: €${adapterCost} + ${dataVolumeGB}GB × €${lp.transferPricePerGB}/GB = €${round(transferCost)}. Total: €${total}`;
  return { cost: total, details };
}

/**
 * Computes the usage-based cost for a single component
 * @param {Object} component - Parsed component { id, type, label, properties }
 * @param {Object} usage - Merged usage values for this component
 * @param {Object} pricingReference - The full pricing reference
 * @returns {{ cost: number, details: string }}
 */
function computeComponentUsageCost(component, usage, pricingReference) {
  const unitPrices = pricingReference.unitPrices;
  const componentPricing = pricingReference.components[component.type];
  const tierCosts = componentPricing
    ? {
        small: componentPricing.tiers.small.cost,
        production: componentPricing.tiers.production.cost,
        enterprise: componentPricing.tiers.enterprise.cost,
      }
    : { ...FALLBACK_TIER_COSTS };

  switch (component.type) {
    case "service":
      return computeServiceCost(usage, unitPrices, tierCosts);
    case "application":
      return computeApplicationCost(usage, unitPrices, tierCosts);
    case "dataProvider":
      return computeDataProviderCost(usage, unitPrices, tierCosts);
    case "identityProvider":
      return computeIdentityProviderCost(usage, unitPrices);
    case "processUnit":
      return computeProcessUnitCost(usage, unitPrices);
    case "securityRealm":
      return computeSecurityRealmCost(usage, unitPrices);
    case "aiApplication":
    case "aiService":
    case "aiProcess":
    case "dataset":
      return computeUserDefinedCost(usage);
    default:
      return { cost: tierCosts.production, details: `Unknown type "${component.type}", using production tier: €${tierCosts.production}` };
  }
}

/**
 * Computes the usage-based cost for a single connection
 * @param {Object} connection - Parsed connection { id, type, from, to, properties }
 * @param {Object} usage - Merged usage values for this connection
 * @param {Object} pricingReference - The full pricing reference
 * @returns {{ cost: number, details: string }}
 */
function computeConnectionUsageCost(connection, usage, pricingReference) {
  const unitPrices = pricingReference.unitPrices;

  switch (connection.type) {
    case "invocation":
      return computeInvocationCost(usage, unitPrices);
    case "trust":
      return computeTrustCost(usage, unitPrices);
    case "legacyConnection":
      return computeLegacyConnectionCost(usage, unitPrices);
    default:
      return { cost: 0, details: `Unknown connection type "${connection.type}", no cost` };
  }
}

/**
 * Estimates costs using user-provided usage overrides for precise calculations.
 * Unlike estimateCost() which returns low/medium/high tiers, this returns a single
 * precise cost based on actual usage values.
 *
 * @param {Object} parsedDiagram - Output from parseDiagram() in diagramParser.js
 * @param {Object} pricingReference - Parsed JSON from pricingReference.json (must include unitPrices)
 * @param {Object} usageOverrides - User overrides { components: { id: { field: value } }, connections: { id: { field: value } } }
 * @returns {Object} - Usage-based cost estimation result
 */
function estimateCostWithUsage(parsedDiagram, pricingReference, usageOverrides) {
  const usageFields = require("./usageFields.json");
  const warnings = [];

  try {
    if (!parsedDiagram) throw new Error("parsedDiagram is required");
    if (!pricingReference) throw new Error("pricingReference is required");
    if (!pricingReference.unitPrices) throw new Error("pricingReference.unitPrices is required");

    const overrides = usageOverrides || { components: {}, connections: {} };
    const componentOverrides = overrides.components || {};
    const connectionOverrides = overrides.connections || {};

    const { components, connections } = parsedDiagram;

    let totalEstimate = 0;
    const componentBreakdown = [];
    const connectionBreakdown = [];

    // Process components
    for (const component of components) {
      const userOverrides = componentOverrides[component.id] || {};
      const mergedUsage = mergeWithDefaults("components", component.type, userOverrides, usageFields);
      const { cost, details } = computeComponentUsageCost(component, mergedUsage, pricingReference);

      componentBreakdown.push({
        id: component.id,
        label: component.label,
        type: component.type,
        cost: round(cost),
        usageInputs: userOverrides,
        costDetails: details,
      });

      totalEstimate += cost;
    }

    // Process connections
    for (const connection of connections) {
      const userOverrides = connectionOverrides[connection.id] || {};
      const mergedUsage = mergeWithDefaults("connections", connection.type, userOverrides, usageFields);
      const { cost, details } = computeConnectionUsageCost(connection, mergedUsage, pricingReference);

      connectionBreakdown.push({
        id: connection.id,
        type: connection.type,
        from: connection.from,
        to: connection.to,
        cost: round(cost),
        usageInputs: userOverrides,
        costDetails: details,
      });

      totalEstimate += cost;
    }

    // Compute diagram-wide modifiers (same as tier-based)
    const modifierBreakdown = computeModifiers(parsedDiagram, pricingReference);
    for (const modifier of modifierBreakdown) {
      totalEstimate += modifier.cost;
    }

    totalEstimate = round(totalEstimate);

    const result = {
      totalEstimate,
      componentBreakdown,
      connectionBreakdown,
      modifierBreakdown,
      metadata: {
        mode: "usage-based",
        estimatedAt: new Date().toISOString(),
        pricingVersion: pricingReference.version,
        currency: pricingReference.currency,
        billingPeriod: pricingReference.billingPeriod,
      },
    };

    if (warnings.length > 0) {
      result.warnings = warnings;
    }

    return result;
  } catch (error) {
    return {
      totalEstimate: 0,
      componentBreakdown: [],
      connectionBreakdown: [],
      modifierBreakdown: [],
      metadata: {
        mode: "usage-based",
        estimatedAt: new Date().toISOString(),
        pricingVersion: pricingReference?.version || "unknown",
        currency: pricingReference?.currency || "EUR",
        billingPeriod: pricingReference?.billingPeriod || "monthly",
      },
      errors: [error.message],
    };
  }
}

module.exports = { estimateCost, estimateCostWithUsage };
