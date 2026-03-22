/**
 * Cost Estimate API Service
 * Handles communication with the backend cost estimation endpoint
 */

const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ??
  "http://localhost:5000";

export type ComponentCost = {
  id: string;
  label: string;
  type: string;
  baseCost: {
    small: number;
    production: number;
    enterprise: number;
  };
  modifiers: string[];
  finalCost: {
    small: number;
    production: number;
    enterprise: number;
  };
};

export type ModifierDetail = {
  name: string;
  applied: boolean;
  addedCost: number;
  reason: string;
};

export type CostEstimateResult = {
  totalCost: {
    small: number;
    production: number;
    enterprise: number;
  };
  components: ComponentCost[];
  modifiers: ModifierDetail[];
  currency: string;
};

export type CostEstimateError = {
  error: string;
  details?: string;
};

// Usage-based estimation types

export type UsageFieldDefinition = {
  key: string;
  label: string;
  type: "number" | "boolean";
  unit?: string;
  default: number | boolean;
  min?: number;
  step?: number;
};

export type UsageTypeDefinition = {
  fields: UsageFieldDefinition[];
  costFormula: string;
};

export type UsageFieldsResponse = {
  components: Record<string, UsageTypeDefinition>;
  connections: Record<string, UsageTypeDefinition>;
};

export type UsageOverrides = {
  components: Record<string, Record<string, number | boolean>>;
  connections: Record<string, Record<string, number | boolean>>;
};

export type UsageComponentCost = {
  id: string;
  label: string;
  type: string;
  cost: number;
  usageInputs: Record<string, number | boolean>;
  costDetails: string;
};

export type UsageConnectionCost = {
  id: string;
  type: string;
  from: string;
  to: string;
  cost: number;
  usageInputs: Record<string, number | boolean>;
  costDetails: string;
};

export type UsageCostEstimateResponse = {
  totalEstimate: number;
  componentBreakdown: UsageComponentCost[];
  connectionBreakdown: UsageConnectionCost[];
  modifierBreakdown: ModifierDetail[];
  metadata: {
    mode: string;
    estimatedAt: string;
    pricingVersion: string;
    currency: string;
    billingPeriod: string;
  };
};

/**
 * Fetches cost estimate from the backend API
 * @param diagram - The JSON-LD representation of the diagram
 * @returns Promise with the cost estimate result
 * @throws Error if the API call fails
 */
export async function fetchCostEstimate(diagram: object): Promise<CostEstimateResult> {
  const response = await fetch(`${API_BASE}/api/cost/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ diagram }),
  });

  if (!response.ok) {
    let errorMessage = "Failed to estimate cost";
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();
  const data = result.data;

  // Transform backend response to match frontend types
  return {
    totalCost: data.totalEstimate,
    components: (data.componentBreakdown ?? []).map(
      (c: { id: string; label: string; type: string; tierCosts: { small: number; production: number; enterprise: number }; appliedModifiers: string[]; defaultEstimate: number }) => ({
        id: c.id,
        label: c.label,
        type: c.type,
        baseCost: { small: c.defaultEstimate, production: c.defaultEstimate, enterprise: c.defaultEstimate },
        modifiers: c.appliedModifiers ?? [],
        finalCost: c.tierCosts,
      })
    ),
    modifiers: (data.modifierBreakdown ?? []).map(
      (m: { modifier: string; applied: boolean; cost: number; reason: string }) => ({
        name: m.modifier,
        applied: m.applied,
        addedCost: m.cost,
        reason: m.reason,
      })
    ),
    currency: data.metadata?.currency ?? "EUR",
  };
}

/**
 * Fetches usage field definitions from the backend
 * @returns Promise with the usage fields for all component and connection types
 */
export async function fetchUsageFields(): Promise<UsageFieldsResponse> {
  const response = await fetch(`${API_BASE}/api/cost/usage-fields`);

  if (!response.ok) {
    throw new Error("Failed to fetch usage field definitions");
  }

  const result = await response.json();
  return result.data;
}

/**
 * Fetches a precise cost estimate using user-provided usage overrides
 * @param diagram - The JSON-LD representation of the diagram
 * @param usageOverrides - User-specified usage values per component/connection
 * @returns Promise with the usage-based cost estimate result
 */
export async function fetchCostEstimateWithUsage(
  diagram: object,
  usageOverrides: UsageOverrides,
): Promise<UsageCostEstimateResponse> {
  const response = await fetch(`${API_BASE}/api/cost/estimate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ diagram, usageOverrides }),
  });

  if (!response.ok) {
    let errorMessage = "Failed to estimate cost";
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  const result = await response.json();
  const data = result.data;

  return {
    totalEstimate: data.totalEstimate,
    componentBreakdown: data.componentBreakdown ?? [],
    connectionBreakdown: data.connectionBreakdown ?? [],
    modifierBreakdown: (data.modifierBreakdown ?? []).map(
      (m: { modifier: string; applied: boolean; cost: number; reason: string }) => ({
        name: m.modifier,
        applied: m.applied,
        addedCost: m.cost,
        reason: m.reason,
      }),
    ),
    metadata: data.metadata,
  };
}
