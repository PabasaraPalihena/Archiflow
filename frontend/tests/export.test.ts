import { describe, it, expect } from "vitest";
import { buildExportJSON, buildExportTurtle } from "../src/utils/exportFormats";
import { buildExportJSONLD } from "../src/utils/exportJSONLD";

describe("Export Formats", () => {
  const mockModel = {
    nodes: [
      {
        id: "node-1",
        type: "wam",
        data: {
          wamType: "application",
          label: "Test App",
          description: "A test application",
          props: {
            publicFacing: true,
            version: 1,
          },
        },
        position: { x: 100, y: 200 },
      },
      {
        id: "node-2",
        type: "wam",
        data: {
          wamType: "service",
          label: "Test Service",
          description: "A test service",
          props: {
            endpoint: "https://api.test.com",
          },
        },
        position: { x: 300, y: 400 },
      },
      {
        id: "node-3",
        type: "unknown_type", // Should be ignored by exports focusing on 'wam' nodes
        data: {},
      },
    ],
    edges: [
      {
        id: "edge-1",
        source: "node-1",
        target: "node-2",
        data: {
          linkType: "invocation",
          description: "Calls the service",
          props: {
            protocol: "HTTPS",
          },
        },
      },
    ],
  };

  it("should generate valid Export JSON", () => {
    const result = buildExportJSON(mockModel);

    expect(result.version).toBe(1);
    expect(result.nodes).toHaveLength(2); // Only 'wam' nodes
    expect(result.edges).toHaveLength(1);

    expect(result.nodes[0].id).toBe("node-1");
    expect(result.nodes[0].label).toBe("Test App");
    expect(result.nodes[0].props.publicFacing).toBe(true);

    expect(result.edges[0].from).toBe("node-1");
    expect(result.edges[0].to).toBe("node-2");
    expect(result.edges[0].type).toBe("invocation");
  });

  it("should generate valid JSON-LD", () => {
    const result = buildExportJSONLD(mockModel);

    expect(result["@context"]).toBeDefined();
    expect(result["@context"].wam).toBe("https://tucid/cpm/wam#");
    expect(result["@graph"]).toHaveLength(3); // 2 nodes + 1 edge

    const appNode = result["@graph"].find((g: any) => g["@id"] === "ex:node-1");
    expect(appNode).toBeDefined();
    expect(appNode["@type"]).toBe("wam:application");
    expect(appNode["rdfs:label"]).toBe("Test App");
    expect(appNode["wam:publicFacing"]).toBe(true);

    const edge = result["@graph"].find((g: any) => g["@id"] === "ex:edge-1");
    expect(edge).toBeDefined();
    expect(edge["@type"]).toBe("wam:invocation");
    expect(edge["wam:from"]["@id"]).toBe("ex:node-1");
    expect(edge["wam:to"]["@id"]).toBe("ex:node-2");
  });

  it("should generate valid Turtle/RDF", () => {
    const result = buildExportTurtle(mockModel);

    // Check prefixes
    expect(result).toContain("@prefix wam: <https://tucid/cpm/wam#> .");
    expect(result).toContain("@prefix ex: <https://tucid/cpm/diagram#> .");

    // Check node 1
    expect(result).toContain("ex:node-1 a wam:application ;");
    expect(result).toContain('rdfs:label "Test App" ;');
    expect(result).toContain('dct:description "A test application" ;');
    expect(result).toContain('wam:publicFacing "true" ;');
    expect(result).toContain('wam:version "1" .'); // ends with period

    // Check node 2
    expect(result).toContain("ex:node-2 a wam:service ;");
    expect(result).toContain('rdfs:label "Test Service" ;');
    expect(result).toContain('wam:endpoint "https://api.test.com" .');

    // Check edge
    expect(result).toContain("ex:edge-1 a wam:invocation ;");
    expect(result).toContain("wam:from ex:node-1 ;");
    expect(result).toContain("wam:to ex:node-2 ;");
    expect(result).toContain('wam:protocol "HTTPS" .');
  });
});
