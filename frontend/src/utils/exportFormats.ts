import type { ModelSnapshot } from "./exportJSONLD";

export function ttlEscape(s: string): string {
  return String(s)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

export function buildExportJSON(model: ModelSnapshot): Record<string, any> {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    nodes: model.nodes
      .filter((n) => n?.type === "wam")
      .map((n) => ({
        id: n.id,
        type: n.data?.wamType ?? "unknown",
        label: n.data?.label ?? "",
        description: n.data?.description ?? "",
        props: n.data?.props ?? {},
        position: n.position,
      })),
    edges: model.edges.map((e) => ({
      id: e.id,
      type: e.data?.linkType ?? "link",
      from: e.source,
      to: e.target,
      description: e.data?.description ?? "",
      props: e.data?.props ?? {},
    })),
  };
}

export function buildExportTurtle(model: ModelSnapshot): string {
  const BASE = "https://tucid/cpm/";
  const wamNS = `${BASE}wam#`;
  const exNS = `${BASE}diagram#`;

  const lines: string[] = [];
  lines.push(`@prefix wam: <${wamNS}> .`);
  lines.push(`@prefix ex: <${exNS}> .`);
  lines.push(`@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .`);
  lines.push(`@prefix dct: <http://purl.org/dc/terms/> .`);
  lines.push("");

  for (const n of model.nodes.filter((x) => x?.type === "wam")) {
    const id = `ex:${n.id}`;
    const wamType = n.data?.wamType ?? "Unknown";
    const label = n.data?.label ?? "";
    const description = n.data?.description ?? "";
    const props = n.data?.props ?? {};

    lines.push(`${id} a wam:${wamType} ;`);
    if (label) lines.push(`  rdfs:label "${ttlEscape(label)}" ;`);
    if (description)
      lines.push(`  dct:description "${ttlEscape(description)}" ;`);

    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === "") continue;
      const lit =
        typeof v === "boolean" || typeof v === "number"
          ? `"${String(v)}"`
          : `"${ttlEscape(String(v))}"`;
      lines.push(`  wam:${k} ${lit} ;`);
    }

    lines[lines.length - 1] = lines[lines.length - 1].replace(/;$/, ".");
    lines.push("");
  }

  for (const e of model.edges) {
    const edgeId = `ex:${e.id}`;
    const s = `ex:${e.source}`;
    const t = `ex:${e.target}`;
    const linkType = e.data?.linkType ?? "link";
    const description = e.data?.description ?? "";
    const props = e.data?.props ?? {};

    lines.push(`${edgeId} a wam:${linkType} ;`);
    lines.push(`  wam:from ${s} ;`);
    lines.push(`  wam:to ${t} ;`);
    if (description)
      lines.push(`  dct:description "${ttlEscape(description)}" ;`);

    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === "") continue;
      const lit =
        typeof v === "boolean" || typeof v === "number"
          ? `"${String(v)}"`
          : `"${ttlEscape(String(v))}"`;
      lines.push(`  wam:${k} ${lit} ;`);
    }

    lines[lines.length - 1] = lines[lines.length - 1].replace(/;$/, ".");
    lines.push("");
  }

  return lines.join("\n");
}

export function buildExportCSV(model: ModelSnapshot): string {
  let csv = "Node ID,Type,Label,Description\n";
  model.nodes
    .filter((n) => n?.type === "wam")
    .forEach((n) => {
      csv += `"${n.id}","${n.data?.wamType || ""}","${n.data?.label || ""}","${n.data?.description || ""}"\n`;
    });
  csv += "\nEdge ID,Type,From,To,Description\n";
  model.edges.forEach((e) => {
    csv += `"${e.id}","${e.data?.linkType || ""}","${e.source}","${e.target}","${e.data?.description || ""}"\n`;
  });
  return csv;
}

export function buildExportXML(model: ModelSnapshot): string {
  const j = buildExportJSON(model);
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<diagram>\n';
  xml += `  <exportedAt>${new Date().toISOString()}</exportedAt>\n`;
  xml += `  <nodes count="${j.nodes.length}">\n`;
  j.nodes.forEach((n: any) => {
    xml += `    <node id="${n.id}" type="${n.type}" label="${n.label}" />\n`;
  });
  xml += "  </nodes>\n";
  xml += `  <edges count="${j.edges.length}">\n`;
  j.edges.forEach((e: any) => {
    xml += `    <edge id="${e.id}" from="${e.from}" to="${e.to}" type="${e.type}" />\n`;
  });
  xml += "  </edges>\n</diagram>";
  return xml;
}
