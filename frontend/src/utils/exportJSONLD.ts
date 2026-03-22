/**
 * Shared utility for building JSON-LD export from diagram model
 */

export type ModelSnapshot = {
  nodes: any[];
  edges: any[];
};

export type JSONLDExport = {
  "@context": {
    wam: string;
    ex: string;
    rdfs: string;
    dct: string;
  };
  "@graph": any[];
};

/**
 * Builds a JSON-LD representation of the diagram model
 * Used for export functionality and cost estimation API
 */
export function buildExportJSONLD(model: ModelSnapshot): JSONLDExport {
  const BASE = "https://tucid/cpm/";
  const wamNS = `${BASE}wam#`;
  const exNS = `${BASE}diagram#`;

  const graph: any[] = [];

  for (const n of model.nodes.filter((x) => x?.type === "wam")) {
    const wamType = n.data?.wamType ?? "Unknown";
    const nodeObj: any = {
      "@id": `ex:${n.id}`,
      "@type": `wam:${wamType}`,
      "rdfs:label": n.data?.label || undefined,
      "dct:description": n.data?.description || undefined,
    };

    const props = n.data?.props ?? {};
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === "") continue;
      nodeObj[`wam:${k}`] = v;
    }
    graph.push(nodeObj);
  }

  for (const e of model.edges) {
    const linkType = e.data?.linkType ?? "link";
    const edgeObj: any = {
      "@id": `ex:${e.id}`,
      "@type": `wam:${linkType}`,
      "wam:from": { "@id": `ex:${e.source}` },
      "wam:to": { "@id": `ex:${e.target}` },
      "dct:description": e.data?.description || undefined,
    };

    const props = e.data?.props ?? {};
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === "") continue;
      edgeObj[`wam:${k}`] = v;
    }
    graph.push(edgeObj);
  }

  return {
    "@context": {
      wam: wamNS,
      ex: exNS,
      rdfs: "http://www.w3.org/2000/01/rdf-schema#",
      dct: "http://purl.org/dc/terms/",
    },
    "@graph": graph,
  };
}

/**
 * Checks if the diagram is empty (no WAM components)
 */
export function isDiagramEmpty(model: ModelSnapshot): boolean {
  const wamNodes = model.nodes.filter((n) => n?.type === "wam");
  return wamNodes.length === 0;
}
