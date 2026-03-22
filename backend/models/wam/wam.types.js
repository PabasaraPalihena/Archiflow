// backend/modules/wam/wam.types.js

const WAM_NODE_TYPES = [
  // WAM core
  "Realm",
  "Application",
  "Service",
  "IdentityProvider",
  "DataProvider",
  "ProcessingUnit",

  // WAM-AI extensions
  "AIApplication",
  "AIService",
  "AIProcess",
  "Dataset",
];

const WAM_EDGE_TYPES = ["Trust", "Invocation", "Legacy", "Contains"];

module.exports = {
  WAM_NODE_TYPES,
  WAM_EDGE_TYPES,
};
