import React, { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import "./PricingPage.css";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";

interface PlanFeature {
  text: string;
  included: boolean;
}

interface PlanCardProps {
  name: string;
  displayName: string;
  price: number | string;
  currency: string;
  aiLimit: string | number;
  exports: string[];
  features: PlanFeature[];
  isCurrent: boolean;
  onUpgrade: (plan: string) => void;
  loading: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({
  name,
  displayName,
  price,
  currency,
  aiLimit,
  exports,
  features,
  isCurrent,
  onUpgrade,
  loading,
}) => {
  const isEnterprise = name === "enterprise";
  const isProfessional = name === "professional";

  return (
    <div
      className={`plan-card ${isEnterprise ? "premium" : ""} ${isCurrent ? "current" : ""}`}
    >
      {isEnterprise && <div className="plan-badge">Most Advanced</div>}
      <h3 className="plan-name">{displayName}</h3>
      <div className="plan-price">
        <span className="amount">
          {currency === "EUR" ? "€" : ""}
          {price}
        </span>
        <span className="period">/month</span>
      </div>

      <div className="plan-limit-info">
        <div className="limit-item">
          <strong>
            {aiLimit === Infinity || aiLimit === "unlimited"
              ? "Unlimited"
              : aiLimit}
          </strong>{" "}
          AI Prompts/day
        </div>
      </div>

      <div className="plan-features">
        {features.map((f, i) => (
          <div
            key={i}
            className={`feature-item ${f.included ? "included" : "excluded"}`}
          >
            <span className="feature-icon">{f.included ? "✅" : "❌"}</span>
            <span className="feature-text">{f.text}</span>
          </div>
        ))}
      </div>

      <div className="plan-exports">
        <p className="exports-label">Supported Exports:</p>
        <div className="export-tags">
          {exports.map((ext) => (
            <span key={ext} className="export-tag">
              {ext.toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      <button
        className={`plan-btn ${isEnterprise ? "btn-premium" : isProfessional ? "btn-standard" : "btn-free"}`}
        onClick={() => onUpgrade(name)}
        disabled={isCurrent || loading}
      >
        {loading
          ? "Processing..."
          : isCurrent
            ? "Current Plan"
            : price === 0
              ? "Downgrade"
              : "Upgrade Now"}
      </button>
    </div>
  );
};

export default function PricingPage() {
  const { user, token, refreshUser } = useAuth();
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [upgradingFor, setUpgradingFor] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/subscription/plans`);
      if (res.data.success) {
        setPlans(res.data.plans);
      }
    } catch (err) {
      console.error("Failed to fetch plans", err);
      toast.error("Failed to load subscription plans.");
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planName: string) => {
    if (!token) return;
    setUpgradingFor(planName);

    try {
      const res = await axios.put(
        `${API_BASE}/api/subscription/upgrade`,
        { plan: planName },
        { headers: { "auth-token": token } },
      );
      if (res.data.success) {
        await refreshUser();
        // Success feedback handled by refreshed UI
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update plan.");
    } finally {
      setUpgradingFor(null);
    }
  };

  if (loading) {
    return (
      <div className="pricing-loading">
        <div className="spinner"></div>
      </div>
    );
  }

  const userPlan = user?.subscription?.plan || "developer";

  return (
    <div className="pricing-container">
      <div className="pricing-header">
        <h1>Simple, Transparent Pricing</h1>
        <p>Choose the plan that fits your architecture design needs.</p>
      </div>

      <div className="plans-grid">
        {plans.map((p) => {
          const featureList: PlanFeature[] = [
            { text: "Manual & AI Drawing", included: p.features.manualDrawing },
            { text: "Model Validation", included: p.features.validation },
            { text: "Cost Modeling", included: p.features.costModeling },
            { text: "Voice Commands", included: p.features.voiceDiagram },
            {
              text: "Confluence/GitHub Integration",
              included: p.features.integrations,
            },
            {
              text: "On-Call Support",
              included: p.features.onCallSupport,
            },
          ];

          return (
            <PlanCard
              key={p.name}
              name={p.name}
              displayName={p.displayName}
              price={p.price}
              currency={p.currency}
              aiLimit={p.aiPromptsPerDay}
              exports={p.allowedExports}
              features={featureList}
              isCurrent={userPlan === p.name}
              onUpgrade={handleUpgrade}
              loading={upgradingFor === p.name}
            />
          );
        })}
      </div>

      <div className="pricing-faq">
        <h2>Frequently Asked Questions</h2>
        <div className="faq-item">
          <h3>Can I cancel anytime?</h3>
          <p>
            Yes, you can downgrade back to the Free plan at any moment from this
            page.
          </p>
        </div>
        <div className="faq-item">
          <h3>What happens if I exceed my AI limit?</h3>
          <p>
            On the Free and Standard plans, AI prompts are capped per day. You
            can continue manual drawing or upgrade for more capacity.
          </p>
        </div>
      </div>
    </div>
  );
}
