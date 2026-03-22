/**
 * Test fixtures for WAM diagram parsing and cost estimation.
 * Each model is a valid JSON-LD document representing a WAM architecture.
 *
 * Naming convention:
 * - parser_* : Models for testing diagramParser (basic structure tests)
 * - cost_*   : Models for testing costEstimator (include pricing-relevant properties)
 */

// ============================================================
// PARSER TEST MODELS
// These models test the diagram parser's ability to extract
// components, connections, and structure from JSON-LD.
// ============================================================

// MODEL 1: Single realm, Application + Process Unit
const parser_model1_simpleRealm = {
  "@context": {
    wam: "https://2019.2.2/wam/",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  },
  "@graph": [
    {
      "@id": "realm-1",
      "@type": "wam:securityRealm",
      "rdfs:label": "Security Realm",
    },
    {
      "@id": "app-1",
      "@type": "wam:application",
      "rdfs:label": "Application",
    },
    {
      "@id": "pu-1",
      "@type": "wam:processUnit",
      "rdfs:label": "Process Unit",
    },
    {
      "@id": "inv-1",
      "@type": "wam:invocation",
      "wam:from": { "@id": "pu-1" },
      "wam:to": { "@id": "app-1" },
    },
  ],
};

// MODEL 2: Two realms, cross-realm trust
const parser_model2_twoRealms = {
  "@context": {
    wam: "https://2019.2.2/wam/",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  },
  "@graph": [
    {
      "@id": "realm-2",
      "@type": "wam:securityRealm",
      "rdfs:label": "Security Realm2",
    },
    {
      "@id": "realm-3",
      "@type": "wam:securityRealm",
      "rdfs:label": "Security Realm3",
    },
    {
      "@id": "svc-2",
      "@type": "wam:service",
      "rdfs:label": "Service2",
    },
    {
      "@id": "svc-1",
      "@type": "wam:service",
      "rdfs:label": "Service1",
    },
    {
      "@id": "pu-ai",
      "@type": "wam:processUnit",
      "rdfs:label": "AI Process",
    },
    {
      "@id": "app-ai-1",
      "@type": "wam:application",
      "rdfs:label": "AI Application",
    },
    {
      "@id": "svc-ai",
      "@type": "wam:service",
      "rdfs:label": "AI Service",
    },
    {
      "@id": "app-ai-2",
      "@type": "wam:application",
      "rdfs:label": "AI Application",
    },
    {
      "@id": "idp-1",
      "@type": "wam:identityProvider",
      "rdfs:label": "Identity Provider",
    },
    {
      "@id": "inv-1",
      "@type": "wam:invocation",
      "wam:from": { "@id": "svc-2" },
      "wam:to": { "@id": "svc-1" },
    },
    {
      "@id": "inv-2",
      "@type": "wam:invocation",
      "wam:from": { "@id": "pu-ai" },
      "wam:to": { "@id": "app-ai-1" },
    },
    {
      "@id": "inv-3",
      "@type": "wam:invocation",
      "wam:from": { "@id": "svc-ai" },
      "wam:to": { "@id": "app-ai-2" },
    },
    {
      "@id": "trust-1",
      "@type": "wam:trust",
      "wam:from": { "@id": "realm-2" },
      "wam:to": { "@id": "realm-3" },
    },
  ],
};

// MODEL 3: Single realm — Application, Service, Identity Provider
const parser_model3_appServiceIdp = {
  "@context": {
    wam: "https://2019.2.2/wam/",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  },
  "@graph": [
    {
      "@id": "realm-1",
      "@type": "wam:securityRealm",
      "rdfs:label": "Security Realm",
    },
    {
      "@id": "app-1",
      "@type": "wam:application",
      "rdfs:label": "Application",
    },
    {
      "@id": "svc-1",
      "@type": "wam:service",
      "rdfs:label": "Service",
    },
    {
      "@id": "idp-1",
      "@type": "wam:identityProvider",
      "rdfs:label": "Identity Provider",
    },
    {
      "@id": "inv-1",
      "@type": "wam:invocation",
      "wam:from": { "@id": "app-1" },
      "wam:to": { "@id": "svc-1" },
    },
  ],
};

// MODEL 4: Single realm — Service + Identity Provider
const parser_model4_serviceIdp = {
  "@context": {
    wam: "https://2019.2.2/wam/",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  },
  "@graph": [
    {
      "@id": "realm-1",
      "@type": "wam:securityRealm",
      "rdfs:label": "Security Realm",
    },
    {
      "@id": "svc-1",
      "@type": "wam:service",
      "rdfs:label": "Service",
    },
    {
      "@id": "idp-1",
      "@type": "wam:identityProvider",
      "rdfs:label": "Identity Provider",
    },
    {
      "@id": "inv-1",
      "@type": "wam:invocation",
      "wam:from": { "@id": "idp-1" },
      "wam:to": { "@id": "svc-1" },
    },
  ],
};

// MODEL 5: Single realm — Service, Dataset, AI Application, Identity Provider
const parser_model5_mixedComponents = {
  "@context": {
    wam: "https://2019.2.2/wam/",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  },
  "@graph": [
    {
      "@id": "realm-1",
      "@type": "wam:securityRealm",
      "rdfs:label": "Security Realm",
    },
    {
      "@id": "svc-1",
      "@type": "wam:service",
      "rdfs:label": "Service",
    },
    {
      "@id": "dp-1",
      "@type": "wam:dataProvider",
      "rdfs:label": "Dataset",
    },
    {
      "@id": "app-ai-1",
      "@type": "wam:application",
      "rdfs:label": "AI Application",
    },
    {
      "@id": "idp-1",
      "@type": "wam:identityProvider",
      "rdfs:label": "Identity Provider",
    },
    {
      "@id": "inv-1",
      "@type": "wam:invocation",
      "wam:from": { "@id": "svc-1" },
      "wam:to": { "@id": "dp-1" },
    },
    {
      "@id": "inv-2",
      "@type": "wam:invocation",
      "wam:from": { "@id": "app-ai-1" },
      "wam:to": { "@id": "idp-1" },
    },
  ],
};

// MODEL 6: Two realms with trust + cross-realm invocation
const parser_model6_crossRealm = {
  "@context": {
    wam: "https://2019.2.2/wam/",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  },
  "@graph": [
    {
      "@id": "realm-default",
      "@type": "wam:securityRealm",
      "rdfs:label": "DefaultRealm",
    },
    {
      "@id": "realm-sec",
      "@type": "wam:securityRealm",
      "rdfs:label": "Security Realm",
    },
    {
      "@id": "svc-ai",
      "@type": "wam:service",
      "rdfs:label": "AI Service",
    },
    {
      "@id": "pu-1",
      "@type": "wam:processUnit",
      "rdfs:label": "Process Unit",
    },
    {
      "@id": "idp-1",
      "@type": "wam:identityProvider",
      "rdfs:label": "IP1",
    },
    {
      "@id": "dp-1",
      "@type": "wam:dataProvider",
      "rdfs:label": "Dataset",
    },
    {
      "@id": "app-ai",
      "@type": "wam:application",
      "rdfs:label": "AI Application",
    },
    {
      "@id": "inv-1",
      "@type": "wam:invocation",
      "wam:from": { "@id": "svc-ai" },
      "wam:to": { "@id": "pu-1" },
    },
    {
      "@id": "inv-2",
      "@type": "wam:invocation",
      "wam:from": { "@id": "realm-default" },
      "wam:to": { "@id": "dp-1" },
    },
    {
      "@id": "inv-3",
      "@type": "wam:invocation",
      "wam:from": { "@id": "dp-1" },
      "wam:to": { "@id": "app-ai" },
    },
    {
      "@id": "trust-1",
      "@type": "wam:trust",
      "wam:from": { "@id": "realm-default" },
      "wam:to": { "@id": "realm-sec" },
    },
  ],
};

// MODEL 7: Single realm — Application + Process Unit
const parser_model7_appProcess = {
  "@context": {
    wam: "https://2019.2.2/wam/",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  },
  "@graph": [
    {
      "@id": "realm-1",
      "@type": "wam:securityRealm",
      "rdfs:label": "Security Realm",
    },
    {
      "@id": "app-1",
      "@type": "wam:application",
      "rdfs:label": "Application",
    },
    {
      "@id": "pu-1",
      "@type": "wam:processUnit",
      "rdfs:label": "Process Unit",
    },
    {
      "@id": "inv-1",
      "@type": "wam:invocation",
      "wam:from": { "@id": "app-1" },
      "wam:to": { "@id": "pu-1" },
    },
  ],
};

// MODEL 8: Classic WAM paper — 4 realms, full federation
const parser_model8_fullFederation = {
  "@context": {
    wam: "https://2019.2.2/wam/",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  },
  "@graph": [
    {
      "@id": "realm-a",
      "@type": "wam:securityRealm",
      "rdfs:label": "Realm A",
    },
    {
      "@id": "realm-b",
      "@type": "wam:securityRealm",
      "rdfs:label": "Realm B",
    },
    {
      "@id": "realm-c",
      "@type": "wam:securityRealm",
      "rdfs:label": "Realm C",
    },
    {
      "@id": "realm-d",
      "@type": "wam:securityRealm",
      "rdfs:label": "Realm D",
    },
    {
      "@id": "app-1",
      "@type": "wam:application",
      "rdfs:label": "APP1",
    },
    {
      "@id": "ws-1",
      "@type": "wam:service",
      "rdfs:label": "WS1",
    },
    {
      "@id": "proc-1",
      "@type": "wam:processUnit",
      "rdfs:label": "PROC1",
    },
    {
      "@id": "ws-2",
      "@type": "wam:service",
      "rdfs:label": "WS2",
    },
    {
      "@id": "data-1",
      "@type": "wam:dataProvider",
      "rdfs:label": "DATA1",
    },
    {
      "@id": "ip-2",
      "@type": "wam:identityProvider",
      "rdfs:label": "IP 2",
    },
    {
      "@id": "ip-1",
      "@type": "wam:identityProvider",
      "rdfs:label": "IP 1",
    },
    {
      "@id": "app-2",
      "@type": "wam:application",
      "rdfs:label": "APP2",
    },
    {
      "@id": "inv-1",
      "@type": "wam:invocation",
      "wam:from": { "@id": "app-1" },
      "wam:to": { "@id": "ws-1" },
    },
    {
      "@id": "inv-2",
      "@type": "wam:invocation",
      "wam:from": { "@id": "app-1" },
      "wam:to": { "@id": "ws-2" },
    },
    {
      "@id": "inv-3",
      "@type": "wam:invocation",
      "wam:from": { "@id": "ws-1" },
      "wam:to": { "@id": "ws-2" },
    },
    {
      "@id": "inv-4",
      "@type": "wam:invocation",
      "wam:from": { "@id": "ws-2" },
      "wam:to": { "@id": "data-1" },
    },
    {
      "@id": "trust-1",
      "@type": "wam:trust",
      "wam:from": { "@id": "realm-c" },
      "wam:to": { "@id": "realm-b" },
    },
    {
      "@id": "trust-2",
      "@type": "wam:trust",
      "wam:from": { "@id": "app-2" },
      "wam:to": { "@id": "ip-1" },
    },
    {
      "@id": "trust-3",
      "@type": "wam:trust",
      "wam:from": { "@id": "realm-d" },
      "wam:to": { "@id": "ip-1" },
    },
  ],
};

// Expected counts for parser model assertions
const parserExpectedCounts = {
  parser_model1_simpleRealm: { components: 3, connections: 1 },
  parser_model2_twoRealms: { components: 9, connections: 4 },
  parser_model3_appServiceIdp: { components: 4, connections: 1 },
  parser_model4_serviceIdp: { components: 3, connections: 1 },
  parser_model5_mixedComponents: { components: 5, connections: 2 },
  parser_model6_crossRealm: { components: 7, connections: 4 },
  parser_model7_appProcess: { components: 3, connections: 1 },
  parser_model8_fullFederation: { components: 12, connections: 7 },
};

// ============================================================
// COST ESTIMATOR TEST MODELS
// These models include pricing-relevant properties like
// wam:encrypted, wam:publicFacing, wam:apiStyle, wam:databaseType
// ============================================================

// Simple realm with encryption and public-facing component
const cost_simpleRealm = {
  "@context": {
    wam: "http://2025.2.2.2:9999/wam#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  },
  "@graph": [
    {
      "@id": "realm-main",
      "@type": "wam:securityRealm",
      "wam:label": "Main Realm",
    },
    {
      "@id": "app-frontend",
      "@type": "wam:application",
      "wam:label": "Web Frontend",
      "wam:publicFacing": true,
    },
    {
      "@id": "svc-api",
      "@type": "wam:service",
      "wam:label": "User API",
      "wam:apiStyle": "REST",
    },
    {
      "@id": "db-users",
      "@type": "wam:dataProvider",
      "wam:label": "User Database",
    },
    {
      "@id": "conn-1",
      "@type": "wam:invocation",
      "wam:from": { "@id": "app-frontend" },
      "wam:to": { "@id": "svc-api" },
      "wam:protocol": "HTTPS",
      "wam:encrypted": true,
    },
    {
      "@id": "conn-2",
      "@type": "wam:invocation",
      "wam:from": { "@id": "svc-api" },
      "wam:to": { "@id": "db-users" },
      "wam:protocol": "HTTPS",
      "wam:encrypted": true,
    },
  ],
};

// Mixed components with various API styles and database types
const cost_mixedComponents = {
  "@context": {
    wam: "http://2025.2.2.2:9999/wam#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  },
  "@graph": [
    {
      "@id": "realm-corp",
      "@type": "wam:securityRealm",
      "wam:label": "Corporate Realm",
    },
    {
      "@id": "app-portal",
      "@type": "wam:application",
      "wam:label": "Employee Portal",
      "wam:publicFacing": false,
    },
    {
      "@id": "svc-auth",
      "@type": "wam:service",
      "wam:label": "Auth Service",
      "wam:apiStyle": "REST",
    },
    {
      "@id": "svc-orders",
      "@type": "wam:service",
      "wam:label": "Order Service",
      "wam:apiStyle": "gRPC",
    },
    {
      "@id": "svc-notifications",
      "@type": "wam:service",
      "wam:label": "Notification Service",
      "wam:apiStyle": "GraphQL",
    },
    {
      "@id": "db-main",
      "@type": "wam:dataProvider",
      "wam:label": "Main Database",
      "wam:databaseType": "SQL",
    },
    {
      "@id": "db-cache",
      "@type": "wam:dataProvider",
      "wam:label": "Cache Layer",
      "wam:databaseType": "NoSQL",
    },
    {
      "@id": "idp-corp",
      "@type": "wam:identityProvider",
      "wam:label": "Corporate IdP",
    },
    {
      "@id": "proc-batch",
      "@type": "wam:processUnit",
      "wam:label": "Batch Processor",
    },
    {
      "@id": "proc-worker",
      "@type": "wam:processUnit",
      "wam:label": "Message Worker",
    },
    {
      "@id": "conn-1",
      "@type": "wam:invocation",
      "wam:from": { "@id": "app-portal" },
      "wam:to": { "@id": "svc-auth" },
      "wam:protocol": "HTTPS",
    },
    {
      "@id": "conn-2",
      "@type": "wam:invocation",
      "wam:from": { "@id": "app-portal" },
      "wam:to": { "@id": "svc-orders" },
      "wam:protocol": "HTTPS",
    },
    {
      "@id": "conn-3",
      "@type": "wam:invocation",
      "wam:from": { "@id": "svc-orders" },
      "wam:to": { "@id": "db-main" },
      "wam:protocol": "HTTPS",
    },
    {
      "@id": "conn-4",
      "@type": "wam:invocation",
      "wam:from": { "@id": "svc-orders" },
      "wam:to": { "@id": "db-cache" },
      "wam:protocol": "HTTP",
    },
    {
      "@id": "conn-5",
      "@type": "wam:invocation",
      "wam:from": { "@id": "svc-orders" },
      "wam:to": { "@id": "svc-notifications" },
      "wam:protocol": "HTTP",
    },
    {
      "@id": "conn-6",
      "@type": "wam:invocation",
      "wam:from": { "@id": "proc-batch" },
      "wam:to": { "@id": "db-main" },
      "wam:protocol": "HTTPS",
    },
    {
      "@id": "conn-7",
      "@type": "wam:invocation",
      "wam:from": { "@id": "proc-worker" },
      "wam:to": { "@id": "svc-notifications" },
      "wam:protocol": "HTTP",
    },
  ],
};

// Full federation with multiple realms, trust, and legacy connections
const cost_fullFederation = {
  "@context": {
    wam: "http://2025.2.2.2:9999/wam#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  },
  "@graph": [
    {
      "@id": "realm-internal",
      "@type": "wam:securityRealm",
      "wam:label": "Internal Realm",
    },
    {
      "@id": "realm-partner",
      "@type": "wam:securityRealm",
      "wam:label": "Partner Realm",
    },
    {
      "@id": "realm-customer",
      "@type": "wam:securityRealm",
      "wam:label": "Customer Realm",
    },
    {
      "@id": "app-internal",
      "@type": "wam:application",
      "wam:label": "Internal Dashboard",
    },
    {
      "@id": "app-partner",
      "@type": "wam:application",
      "wam:label": "Partner Portal",
      "wam:publicFacing": true,
    },
    {
      "@id": "app-customer",
      "@type": "wam:application",
      "wam:label": "Customer App",
      "wam:publicFacing": true,
    },
    {
      "@id": "svc-core",
      "@type": "wam:service",
      "wam:label": "Core API",
      "wam:apiStyle": "REST",
    },
    {
      "@id": "svc-partner-api",
      "@type": "wam:service",
      "wam:label": "Partner API",
      "wam:apiStyle": "SOAP",
    },
    {
      "@id": "svc-customer-api",
      "@type": "wam:service",
      "wam:label": "Customer API",
      "wam:apiStyle": "REST",
    },
    {
      "@id": "db-core",
      "@type": "wam:dataProvider",
      "wam:label": "Core Database",
      "wam:databaseType": "SQL",
    },
    {
      "@id": "db-partner",
      "@type": "wam:dataProvider",
      "wam:label": "Partner Data Store",
      "wam:databaseType": "NoSQL",
    },
    {
      "@id": "idp-internal",
      "@type": "wam:identityProvider",
      "wam:label": "Internal IdP",
    },
    {
      "@id": "idp-partner",
      "@type": "wam:identityProvider",
      "wam:label": "Partner IdP",
    },
    {
      "@id": "idp-customer",
      "@type": "wam:identityProvider",
      "wam:label": "Customer IdP",
    },
    {
      "@id": "proc-sync",
      "@type": "wam:processUnit",
      "wam:label": "Data Sync Processor",
    },
    {
      "@id": "trust-1",
      "@type": "wam:trust",
      "wam:from": { "@id": "realm-internal" },
      "wam:to": { "@id": "realm-partner" },
    },
    {
      "@id": "trust-2",
      "@type": "wam:trust",
      "wam:from": { "@id": "realm-internal" },
      "wam:to": { "@id": "realm-customer" },
    },
    {
      "@id": "trust-3",
      "@type": "wam:trust",
      "wam:from": { "@id": "realm-partner" },
      "wam:to": { "@id": "realm-customer" },
    },
    {
      "@id": "legacy-1",
      "@type": "wam:legacyConnection",
      "wam:from": { "@id": "svc-partner-api" },
      "wam:to": { "@id": "db-partner" },
    },
    {
      "@id": "conn-1",
      "@type": "wam:invocation",
      "wam:from": { "@id": "app-internal" },
      "wam:to": { "@id": "svc-core" },
      "wam:protocol": "HTTPS",
      "wam:encrypted": true,
    },
    {
      "@id": "conn-2",
      "@type": "wam:invocation",
      "wam:from": { "@id": "app-partner" },
      "wam:to": { "@id": "svc-partner-api" },
      "wam:protocol": "HTTPS",
      "wam:encrypted": true,
    },
    {
      "@id": "conn-3",
      "@type": "wam:invocation",
      "wam:from": { "@id": "app-customer" },
      "wam:to": { "@id": "svc-customer-api" },
      "wam:protocol": "HTTPS",
      "wam:encrypted": true,
    },
    {
      "@id": "conn-4",
      "@type": "wam:invocation",
      "wam:from": { "@id": "svc-core" },
      "wam:to": { "@id": "db-core" },
      "wam:protocol": "HTTPS",
      "wam:encrypted": true,
    },
    {
      "@id": "conn-5",
      "@type": "wam:invocation",
      "wam:from": { "@id": "svc-partner-api" },
      "wam:to": { "@id": "svc-core" },
      "wam:protocol": "HTTPS",
      "wam:encrypted": true,
    },
    {
      "@id": "conn-6",
      "@type": "wam:invocation",
      "wam:from": { "@id": "svc-customer-api" },
      "wam:to": { "@id": "svc-core" },
      "wam:protocol": "HTTPS",
      "wam:encrypted": true,
    },
    {
      "@id": "conn-7",
      "@type": "wam:invocation",
      "wam:from": { "@id": "proc-sync" },
      "wam:to": { "@id": "db-core" },
      "wam:protocol": "HTTPS",
      "wam:encrypted": true,
    },
  ],
};

// ============================================================
// EXPORTS
// ============================================================

// Parser models (grouped)
const parserModels = {
  parser_model1_simpleRealm,
  parser_model2_twoRealms,
  parser_model3_appServiceIdp,
  parser_model4_serviceIdp,
  parser_model5_mixedComponents,
  parser_model6_crossRealm,
  parser_model7_appProcess,
  parser_model8_fullFederation,
};

// Cost models (grouped)
const costModels = {
  cost_simpleRealm,
  cost_mixedComponents,
  cost_fullFederation,
};

module.exports = {
  // Individual parser models
  ...parserModels,
  // Individual cost models
  ...costModels,
  // Grouped exports
  parserModels,
  costModels,
  parserExpectedCounts,
};
