/**
 * Parses a WAM JSON-LD diagram and extracts a structured summary.
 */

const NODE_TYPES = [
  "wam:securityRealm",
  "wam:service",
  "wam:application",
  "wam:dataProvider",
  "wam:identityProvider",
  "wam:processUnit",
  // WAM-AI extensions
  "wam:aiApplication",
  "wam:aiService",
  "wam:aiProcess",
  "wam:dataset",
];

const EDGE_TYPES = ["wam:invocation", "wam:trust", "wam:legacyConnection"];

/**
 * Extracts the short type name from a wam: prefixed type
 * @param {string} type - The full type (e.g., "wam:service")
 * @returns {string} - The short type (e.g., "service")
 */
function getShortType(type) {
  if (!type) return "unknown";
  return type.replace("wam:", "");
}

/**
 * Gets the label from a node, checking both wam:label and rdfs:label
 * @param {Object} item - The JSON-LD item
 * @returns {string} - The label or the @id as fallback
 */
function getLabel(item) {
  return item["wam:label"] || item["rdfs:label"] || item["@id"];
}

/**
 * Extracts the ID from a from/to reference (handles both string and object formats)
 * @param {string|Object} ref - The reference (either "id" or { "@id": "id" })
 * @returns {string} - The extracted ID
 */
function extractRefId(ref) {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  if (typeof ref === "object" && ref["@id"]) return ref["@id"];
  return null;
}

/**
 * Extracts properties from a node/edge that have wam: prefix
 * @param {Object} item - The JSON-LD item
 * @returns {Object} - Object containing wam: properties
 */
function extractWamProperties(item) {
  const properties = {};
  const skipKeys = ["@id", "@type", "wam:from", "wam:to", "wam:label", "rdfs:label"];

  for (const key of Object.keys(item)) {
    if (key.startsWith("wam:") && !skipKeys.includes(key)) {
      const shortKey = key.replace("wam:", "");
      properties[shortKey] = item[key];
    }
  }

  return properties;
}

/**
 * Parses a WAM JSON-LD diagram object
 * @param {Object} jsonld - The parsed JSON-LD object
 * @returns {Object} - Structured diagram data with components, connections, and summary
 */
function parseDiagram(jsonld) {
  if (!jsonld || !jsonld["@graph"]) {
    throw new Error("Invalid JSON-LD: missing @graph array");
  }

  const graph = jsonld["@graph"];

  // Separate nodes from edges: iterate through the graph and categorize each item
  // based on its @type - NODE_TYPES become nodes, EDGE_TYPES become edges
  const nodes = [];
  const edges = [];

  for (const item of graph) {
    const type = item["@type"];
    if (NODE_TYPES.includes(type)) {
      nodes.push(item);
    } else if (EDGE_TYPES.includes(type)) {
      edges.push(item);
    }
  }

  // Build ID to label lookup map: create a dictionary mapping node @id values
  // to their human-readable labels for use when resolving connection endpoints
  const idToLabel = {};
  for (const node of nodes) {
    const id = node["@id"];
    idToLabel[id] = getLabel(node);
  }

  // Process components: transform raw JSON-LD nodes into a standardized format
  // with extracted IDs, short type names, labels, and additional wam: properties
  const components = nodes.map((node) => ({
    id: node["@id"],
    type: getShortType(node["@type"]),
    label: getLabel(node),
    properties: extractWamProperties(node),
  }));

  // Process connections: transform raw JSON-LD edges into a standardized format,
  // resolving source/target node IDs to human-readable labels where available
  const connections = edges.map((edge) => {
    const fromId = extractRefId(edge["wam:from"]);
    const toId = extractRefId(edge["wam:to"]);

    return {
      id: edge["@id"],
      type: getShortType(edge["@type"]),
      from: idToLabel[fromId] || fromId,
      fromId: fromId,
      to: idToLabel[toId] || toId,
      toId: toId,
      properties: extractWamProperties(edge),
    };
  });

  // Build summary: aggregate statistics about the diagram including component
  // counts by type, security properties, and communication protocols used
  const componentCounts = {};
  for (const component of components) {
    const type = component.type;
    componentCounts[type] = (componentCounts[type] || 0) + 1;
  }

  // Check for encryption: determine if any connection has the encrypted property
  // set to true, indicating secure communication channels in the architecture
  const hasEncryption = connections.some(
    (conn) =>
      conn.properties.encrypted === true ||
      conn.properties.encrypted === "true"
  );

  // Check for public-facing components: identify if any component is exposed
  // to external users/networks, which is important for security analysis
  const hasPublicFacing = components.some(
    (comp) =>
      comp.properties.publicFacing === true ||
      comp.properties.publicFacing === "true"
  );

  // Collect unique protocols: gather all distinct communication protocols
  // (e.g., HTTP, HTTPS, gRPC) used across connections for the summary
  const protocols = [
    ...new Set(
      connections
        .map((conn) => conn.properties.protocol)
        .filter((p) => p !== undefined && p !== null)
    ),
  ];

  const summary = {
    totalComponents: components.length,
    totalConnections: connections.length,
    componentCounts,
    hasEncryption,
    hasPublicFacing,
    protocols,
  };

  return {
    components,
    connections,
    summary,
  };
}

module.exports = { parseDiagram };
