/**
 * Subscription Plans Configuration
 * Defines the limits and features for each subscription tier
 */

const SUBSCRIPTION_PLANS = {
  developer: {
    name: "developer",
    displayName: "Developer Plan",
    aiPromptsPerDay: 15,
    allowedExports: ["png", "json"],
    features: {
      manualDrawing: true,
      validation: true,
      costModeling: false,
      voiceDiagram: false,
      integrations: false,
      onCallSupport: false,
    },
    price: 0,
    currency: "EUR",
  },
  professional: {
    name: "professional",
    displayName: "Professional Plan",
    aiPromptsPerDay: 75,
    allowedExports: ["png", "json", "csv", "xml", "turtle", "json-ld"],
    features: {
      manualDrawing: true,
      validation: true,
      costModeling: true,
      voiceDiagram: false,
      integrations: false,
      onCallSupport: false,
    },
    price: 14.99,
    currency: "EUR",
  },
  enterprise: {
    name: "enterprise",
    displayName: "Enterprise Plan",
    aiPromptsPerDay: Infinity, // Unlimited
    allowedExports: ["png", "json", "csv", "xml", "turtle", "json-ld"],
    features: {
      manualDrawing: true,
      validation: true,
      costModeling: true,
      voiceDiagram: true,
      integrations: true,
      onCallSupport: true,
    },
    price: "Custom",
    currency: "EUR",
    availableIntegrations: ["jira", "github", "trello", "slack"],
  },
};

/**
 * Get plan by name
 * @param {string} planName - 'developer', 'professional', or 'enterprise'
 * @returns {Object} Plan configuration
 */
function getPlan(planName) {
  return SUBSCRIPTION_PLANS[planName] || SUBSCRIPTION_PLANS.developer;
}

/**
 * Check if export format is allowed for a plan
 * @param {string} planName - Plan name
 * @param {string} format - Export format (e.g., 'png', 'csv')
 * @returns {boolean}
 */
function isExportAllowed(planName, format) {
  const plan = getPlan(planName);
  return plan.allowedExports.includes(format);
}

/**
 * Check if a feature is available for a plan
 * @param {string} planName - Plan name
 * @param {string} feature - Feature name
 * @returns {boolean}
 */
function isFeatureAvailable(planName, feature) {
  const plan = getPlan(planName);
  return plan.features[feature] === true;
}

/**
 * Get AI prompts limit for a plan
 * @param {string} planName - Plan name
 * @returns {number}
 */
function getAIPromptsLimit(planName) {
  const plan = getPlan(planName);
  return plan.aiPromptsPerDay;
}

module.exports = {
  SUBSCRIPTION_PLANS,
  getPlan,
  isExportAllowed,
  isFeatureAvailable,
  getAIPromptsLimit,
};
