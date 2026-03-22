import { useState, useEffect, useCallback, useRef } from "react";
import {
  fetchCostEstimate,
  fetchUsageFields,
  fetchCostEstimateWithUsage,
  type CostEstimateResult,
  type ComponentCost,
  type ModifierDetail,
  type UsageFieldsResponse,
  type UsageFieldDefinition,
  type UsageCostEstimateResponse,
  type UsageOverrides,
  type UsageComponentCost,
  type UsageConnectionCost,
} from "../../services/costEstimateService";
import { type JSONLDExport } from "../../utils/exportJSONLD";

type CostEstimateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  getDiagramJSONLD: () => JSONLDExport;
};

type ModalState = "loading" | "empty" | "error" | "success";

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      className={`w-5 h-5 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 9l-7 7-7-7"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-4 h-4 text-green-500"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function XIcon() {
  return (
    <svg
      className="w-4 h-4 text-gray-400"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      className="w-5 h-5"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
      <p className="mt-4 text-gray-500 text-sm">Calculating cost estimate...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        No Components Found
      </h3>
      <p className="text-gray-500 text-sm max-w-xs">
        Add some components to your diagram first to estimate costs.
      </p>
    </div>
  );
}

function ErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        Estimation Failed
      </h3>
      <p className="text-gray-500 text-sm max-w-xs mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
      >
        Retry
      </button>
    </div>
  );
}

function formatCost(amount: number): string {
  return `€${amount.toFixed(2)}`;
}

function CostCard({
  label,
  amount,
  isHighlighted = false,
  dimmed = false,
}: {
  label: string;
  amount: number;
  isHighlighted?: boolean;
  dimmed?: boolean;
}) {
  return (
    <div
      className={`flex-1 p-4 rounded-xl border-2 transition-all ${
        dimmed
          ? "border-gray-100 bg-gray-50 opacity-50"
          : isHighlighted
            ? "border-purple-300 bg-purple-50 shadow-md scale-105"
            : "border-gray-200 bg-white"
      }`}
    >
      {isHighlighted && !dimmed && (
        <span className="inline-block px-2 py-0.5 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full mb-2">
          Recommended
        </span>
      )}
      <p
        className={`text-2xl font-bold ${dimmed ? "text-gray-400" : isHighlighted ? "text-purple-700" : "text-gray-800"}`}
      >
        {formatCost(amount)}
        <span className="text-sm font-normal text-gray-500">/mo</span>
      </p>
      <p
        className={`text-sm mt-1 ${dimmed ? "text-gray-400" : isHighlighted ? "text-purple-600" : "text-gray-500"}`}
      >
        {label}
      </p>
    </div>
  );
}

function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-medium text-gray-700">{title}</span>
        <ChevronIcon isOpen={isOpen} />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="p-4 bg-white">{children}</div>
      </div>
    </div>
  );
}

function ComponentBreakdown({ components }: { components: ComponentCost[] }) {
  // Sort by medium cost descending
  const sortedComponents = [...components].sort(
    (a, b) => b.finalCost.production - a.finalCost.production,
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-2 px-2 font-medium text-gray-600">
              Component
            </th>
            <th className="text-left py-2 px-2 font-medium text-gray-600">
              Type
            </th>
            <th className="text-right py-2 px-2 font-medium text-gray-600">
              Small
            </th>
            <th className="text-right py-2 px-2 font-medium text-gray-600">
              Production
            </th>
            <th className="text-right py-2 px-2 font-medium text-gray-600">
              Enterprise
            </th>
            <th className="text-left py-2 px-2 font-medium text-gray-600">
              Modifiers
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedComponents.map((component) => (
            <tr
              key={component.id}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="py-2 px-2 font-medium text-gray-800">
                {component.label || component.id}
              </td>
              <td className="py-2 px-2 text-gray-600">{component.type}</td>
              <td className="py-2 px-2 text-right text-gray-600">
                {formatCost(component.finalCost.small)}
              </td>
              <td className="py-2 px-2 text-right font-medium text-purple-700">
                {formatCost(component.finalCost.production)}
              </td>
              <td className="py-2 px-2 text-right text-gray-600">
                {formatCost(component.finalCost.enterprise)}
              </td>
              <td className="py-2 px-2">
                {component.modifiers.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {component.modifiers.map((mod) => (
                      <span
                        key={mod}
                        className="inline-block px-1.5 py-0.5 text-xs bg-purple-100 text-purple-700 rounded"
                      >
                        {mod}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModifiersApplied({ modifiers }: { modifiers: ModifierDetail[] }) {
  return (
    <div className="space-y-3">
      {modifiers.map((modifier) => (
        <div
          key={modifier.name}
          className="flex items-start gap-3 p-3 rounded-lg bg-gray-50"
        >
          <div className="mt-0.5">
            {modifier.applied ? <CheckIcon /> : <XIcon />}
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-800 capitalize">
                {modifier.name}
              </span>
              {modifier.applied && (
                <span className="text-sm font-medium text-green-600">
                  +{formatCost(modifier.addedCost)}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{modifier.reason}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

const TYPE_LABELS: Record<string, string> = {
  service: "Service",
  application: "Application",
  dataProvider: "Database",
  identityProvider: "Identity",
  processUnit: "Process",
  securityRealm: "Realm",
  aiApplication: "AI App",
  aiService: "AI Service",
  aiProcess: "AI Process",
  dataset: "Dataset",
  invocation: "Invocation",
  trust: "Trust",
  legacyConnection: "Legacy",
};

function TypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    service: "bg-blue-100 text-blue-700",
    application: "bg-green-100 text-green-700",
    dataProvider: "bg-amber-100 text-amber-700",
    identityProvider: "bg-rose-100 text-rose-700",
    processUnit: "bg-cyan-100 text-cyan-700",
    securityRealm: "bg-gray-100 text-gray-700",
    aiApplication: "bg-violet-100 text-violet-700",
    aiService: "bg-fuchsia-100 text-fuchsia-700",
    aiProcess: "bg-purple-100 text-purple-700",
    dataset: "bg-teal-100 text-teal-700",
    invocation: "bg-indigo-100 text-indigo-700",
    trust: "bg-pink-100 text-pink-700",
    legacyConnection: "bg-orange-100 text-orange-700",
  };
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${colors[type] || "bg-gray-100 text-gray-600"}`}>
      {TYPE_LABELS[type] || type}
    </span>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      } ${checked ? "bg-purple-600" : "bg-gray-200"}`}
    >
      <span
        className="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out"
        style={{ transform: checked ? "translateX(19px)" : "translateX(3px)" }}
      />
    </button>
  );
}

function UsageFieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: UsageFieldDefinition;
  value: number | boolean | undefined;
  onChange: (key: string, val: number | boolean) => void;
  disabled?: boolean;
}) {
  if (field.type === "boolean") {
    const checked = typeof value === "boolean" ? value : (field.default as boolean);
    return (
      <div className="flex items-center justify-between py-2">
        <label className="text-sm text-gray-700">{field.label}</label>
        <ToggleSwitch
          checked={checked}
          onChange={(val) => onChange(field.key, val)}
          disabled={disabled}
        />
      </div>
    );
  }

  const numValue = typeof value === "number" ? value : (field.default as number);
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between py-2 gap-1 sm:gap-4">
      <label className="text-sm text-gray-700 shrink-0">
        {field.label}
        {field.unit && (
          <span className="text-xs text-gray-400 ml-1">({field.unit})</span>
        )}
      </label>
      <input
        type="number"
        value={numValue}
        min={field.min}
        step={field.step}
        disabled={disabled}
        onChange={(e) => onChange(field.key, Number(e.target.value))}
        className="w-32 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
        placeholder={String(field.default)}
      />
    </div>
  );
}

function UsageAccordionRow({
  id,
  label,
  type,
  currentCost,
  fields,
  values,
  onFieldChange,
  disabled,
  costDetails,
}: {
  id: string;
  label: string;
  type: string;
  currentCost?: number;
  fields: UsageFieldDefinition[];
  values: Record<string, number | boolean>;
  onFieldChange: (itemId: string, fieldKey: string, val: number | boolean) => void;
  disabled?: boolean;
  costDetails?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left gap-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <TypeBadge type={type} />
          <span className="font-medium text-gray-800 text-sm truncate">{label || id}</span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {currentCost !== undefined && (
            <span className="text-sm font-medium text-purple-700">
              {formatCost(currentCost)}
            </span>
          )}
          <ChevronIcon isOpen={isOpen} />
        </div>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="px-4 pb-4 pt-2 bg-white border-t border-gray-100">
          <div className="divide-y divide-gray-100">
            {fields.map((field) => (
              <UsageFieldInput
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={(key, val) => onFieldChange(id, key, val)}
                disabled={disabled}
              />
            ))}
          </div>
          {costDetails && (
            <p className="mt-3 text-xs text-gray-500 bg-gray-50 rounded p-2 leading-relaxed">
              {costDetails}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function UsageBasedResultCard({ totalEstimate }: { totalEstimate: number }) {
  return (
    <div className="p-5 rounded-xl border-2 border-purple-400 bg-purple-50 shadow-lg">
      <span className="inline-block px-2 py-0.5 text-xs font-semibold text-purple-700 bg-purple-100 rounded-full mb-2">
        Your Estimated Cost
      </span>
      <p className="text-3xl font-bold text-purple-700">
        {formatCost(totalEstimate)}
        <span className="text-sm font-normal text-gray-500">/mo</span>
      </p>
      <p className="text-sm mt-1 text-purple-600">Based on your usage inputs</p>
    </div>
  );
}

function UsageBreakdownTable({
  components,
  connections,
}: {
  components: UsageComponentCost[];
  connections: UsageConnectionCost[];
}) {
  const sortedComponents = [...components].sort((a, b) => b.cost - a.cost);

  return (
    <div className="space-y-4">
      {sortedComponents.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Components</h4>
          <div className="space-y-2">
            {sortedComponents.map((comp) => (
              <div key={comp.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <TypeBadge type={comp.type} />
                    <span className="text-sm font-medium text-gray-800">{comp.label || comp.id}</span>
                  </div>
                  <span className="text-sm font-bold text-purple-700">{formatCost(comp.cost)}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{comp.costDetails}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      {connections.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Connections</h4>
          <div className="space-y-2">
            {connections.map((conn) => (
              <div key={conn.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <TypeBadge type={conn.type} />
                    <span className="text-sm text-gray-700">{conn.from} → {conn.to}</span>
                  </div>
                  <span className="text-sm font-bold text-purple-700">{formatCost(conn.cost)}</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">{conn.costDetails}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RefineEstimateSection({
  result,
  usageFields,
  usageInputs,
  onFieldChange,
  onRecalculate,
  isRecalculating,
  changedFieldCount,
  usageResult,
}: {
  result: CostEstimateResult;
  usageFields: UsageFieldsResponse;
  usageInputs: Record<string, Record<string, number | boolean>>;
  onFieldChange: (itemId: string, fieldKey: string, val: number | boolean) => void;
  onRecalculate: () => void;
  isRecalculating: boolean;
  changedFieldCount: number;
  usageResult: UsageCostEstimateResponse | null;
}) {
  return (
    <div className="space-y-4 mt-6 pt-6 border-t border-gray-200">
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-1">
          Customize usage details for a precise estimate
        </h3>
        <p className="text-xs text-gray-500">
          Expand each component to enter your expected usage values
        </p>
      </div>

      {/* Component rows */}
      {result.components.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Components</h4>
          {result.components.map((comp) => {
            const typeFields = usageFields.components[comp.type];
            if (!typeFields) return null;
            const usageComp = usageResult?.componentBreakdown.find((c) => c.id === comp.id);
            return (
              <UsageAccordionRow
                key={comp.id}
                id={comp.id}
                label={comp.label || comp.id}
                type={comp.type}
                currentCost={usageComp?.cost ?? comp.finalCost.production}
                fields={typeFields.fields}
                values={usageInputs[comp.id] || {}}
                onFieldChange={onFieldChange}
                disabled={isRecalculating}
                costDetails={usageComp?.costDetails}
              />
            );
          })}
        </div>
      )}

      {/* Connection rows — only show if usageFields has matching connection types */}
      {(() => {
        const connectionsWithFields = (usageResult?.connectionBreakdown ?? []).filter(
          (conn) => usageFields.connections[conn.type],
        );
        // Also check from initial result if usageResult not available yet
        const initialConnections = result.components.length > 0 ? [] : []; // connections aren't in CostEstimateResult directly, so we use usageResult
        if (connectionsWithFields.length === 0 && initialConnections.length === 0) return null;
        return connectionsWithFields.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Connections</h4>
            {connectionsWithFields.map((conn) => {
              const typeFields = usageFields.connections[conn.type];
              if (!typeFields) return null;
              return (
                <UsageAccordionRow
                  key={conn.id}
                  id={conn.id}
                  label={`${conn.from} → ${conn.to}`}
                  type={conn.type}
                  currentCost={conn.cost}
                  fields={typeFields.fields}
                  values={usageInputs[conn.id] || {}}
                  onFieldChange={onFieldChange}
                  disabled={isRecalculating}
                  costDetails={conn.costDetails}
                />
              );
            })}
          </div>
        ) : null;
      })()}

      {/* Recalculate button */}
      {changedFieldCount > 0 && (
        <div className="sticky bottom-0 bg-white pt-3 pb-1">
          <button
            onClick={onRecalculate}
            disabled={isRecalculating}
            className="w-full px-4 py-2.5 bg-purple-600 border-none text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isRecalculating ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Recalculating...
              </>
            ) : (
              `Recalculate (${changedFieldCount} field${changedFieldCount !== 1 ? "s" : ""} changed)`
            )}
          </button>
        </div>
      )}
    </div>
  );
}

function ResultsDisplay({
  result,
  usageFields,
  usageInputs,
  onFieldChange,
  onRecalculate,
  isRecalculating,
  changedFieldCount,
  usageResult,
}: {
  result: CostEstimateResult;
  usageFields: UsageFieldsResponse | null;
  usageInputs: Record<string, Record<string, number | boolean>>;
  onFieldChange: (itemId: string, fieldKey: string, val: number | boolean) => void;
  onRecalculate: () => void;
  isRecalculating: boolean;
  changedFieldCount: number;
  usageResult: UsageCostEstimateResponse | null;
}) {
  return (
    <div className="space-y-6">
      {/* Usage-based result (shown after recalculation) */}
      {usageResult && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
            Usage-Based Estimate
          </h3>
          <UsageBasedResultCard totalEstimate={usageResult.totalEstimate} />
        </div>
      )}

      {/* Total Estimate Summary (tier-based) */}
      <div>
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          {usageResult ? "Tier-Based Estimate" : "Monthly Estimate"}
        </h3>
        <div className="flex gap-3">
          <CostCard label="Small" amount={result.totalCost.small} dimmed={!!usageResult} />
          <CostCard
            label="Production"
            amount={result.totalCost.production}
            isHighlighted
            dimmed={!!usageResult}
          />
          <CostCard label="Enterprise" amount={result.totalCost.enterprise} dimmed={!!usageResult} />
        </div>
      </div>

      {/* Usage-based breakdown (shown after recalculation) */}
      {usageResult && (
        <CollapsibleSection title="Usage-Based Breakdown" defaultOpen>
          <UsageBreakdownTable
            components={usageResult.componentBreakdown}
            connections={usageResult.connectionBreakdown}
          />
        </CollapsibleSection>
      )}

      {/* Component Breakdown (tier-based) */}
      {result.components.length > 0 && !usageResult && (
        <CollapsibleSection
          title={`Component Breakdown (${result.components.length})`}
        >
          <ComponentBreakdown components={result.components} />
        </CollapsibleSection>
      )}

      {/* Modifiers Applied */}
      {result.modifiers.length > 0 && (
        <CollapsibleSection title="Modifiers Applied">
          <ModifiersApplied modifiers={result.modifiers} />
        </CollapsibleSection>
      )}

      {/* Refine Your Estimate section */}
      {usageFields && (
        <RefineEstimateSection
          result={result}
          usageFields={usageFields}
          usageInputs={usageInputs}
          onFieldChange={onFieldChange}
          onRecalculate={onRecalculate}
          isRecalculating={isRecalculating}
          changedFieldCount={changedFieldCount}
          usageResult={usageResult}
        />
      )}
    </div>
  );
}

export default function CostEstimateModal({
  isOpen,
  onClose,
  getDiagramJSONLD,
}: CostEstimateModalProps) {
  const [state, setState] = useState<ModalState>("loading");
  const [result, setResult] = useState<CostEstimateResult | null>(null);
  const [error, setError] = useState<string>("");

  // Usage-based state
  const [usageFields, setUsageFields] = useState<UsageFieldsResponse | null>(null);
  const [usageInputs, setUsageInputs] = useState<Record<string, Record<string, number | boolean>>>({});
  const [usageResult, setUsageResult] = useState<UsageCostEstimateResponse | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const diagramRef = useRef<JSONLDExport | null>(null);

  const changedFieldCount = Object.values(usageInputs).reduce(
    (sum, fields) => sum + Object.keys(fields).length,
    0,
  );

  const fetchEstimate = useCallback(async () => {
    setState("loading");
    setError("");
    setUsageResult(null);
    setUsageInputs({});

    try {
      const jsonld = getDiagramJSONLD();
      diagramRef.current = jsonld;

      // Check if diagram is empty
      if (!jsonld["@graph"] || jsonld["@graph"].length === 0) {
        setState("empty");
        return;
      }

      // Fetch initial estimate and usage fields in parallel
      const [data, fields] = await Promise.all([
        fetchCostEstimate(jsonld),
        fetchUsageFields().catch(() => null),
      ]);

      setResult(data);
      setUsageFields(fields);
      setState("success");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
      setState("error");
    }
  }, [getDiagramJSONLD]);

  const handleFieldChange = useCallback(
    (itemId: string, fieldKey: string, val: number | boolean) => {
      setUsageInputs((prev) => ({
        ...prev,
        [itemId]: {
          ...(prev[itemId] || {}),
          [fieldKey]: val,
        },
      }));
    },
    [],
  );

  const handleRecalculate = useCallback(async () => {
    if (!diagramRef.current || changedFieldCount === 0) return;

    setIsRecalculating(true);
    try {
      // Separate component vs connection overrides based on result data
      const componentIds = new Set(result?.components.map((c) => c.id) ?? []);
      const overrides: UsageOverrides = { components: {}, connections: {} };

      for (const [id, fields] of Object.entries(usageInputs)) {
        if (Object.keys(fields).length === 0) continue;
        if (componentIds.has(id)) {
          overrides.components[id] = fields;
        } else {
          overrides.connections[id] = fields;
        }
      }

      const usageData = await fetchCostEstimateWithUsage(diagramRef.current, overrides);
      setUsageResult(usageData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Recalculation failed",
      );
    } finally {
      setIsRecalculating(false);
    }
  }, [changedFieldCount, result, usageInputs]);

  // Fetch estimate when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchEstimate();
    }
  }, [isOpen, fetchEstimate]);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[90vh] mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Cost Estimate</h2>
            <p className="text-sm text-gray-500 mt-1">
              Estimated monthly cloud hosting costs for this architecture
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-600"
            aria-label="Close modal"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-180px)]">
          {state === "loading" && <LoadingSpinner />}
          {state === "empty" && <EmptyState />}
          {state === "error" && (
            <ErrorState error={error} onRetry={fetchEstimate} />
          )}
          {state === "success" && result && (
            <ResultsDisplay
              result={result}
              usageFields={usageFields}
              usageInputs={usageInputs}
              onFieldChange={handleFieldChange}
              onRecalculate={handleRecalculate}
              isRecalculating={isRecalculating}
              changedFieldCount={changedFieldCount}
              usageResult={usageResult}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50">
          <p className="text-xs text-gray-500 mb-3">
            Estimates are based on typical cloud hosting costs and may vary
            significantly based on provider, region, and actual usage.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-purple-600 border-none text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
