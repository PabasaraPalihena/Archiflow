import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { Link } from "react-router-dom";
import "./Settings.css";
import toast from "react-hot-toast";
import ConfirmModal from "../ConfirmModal/ConfirmModal";
import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

interface PlanInfo {
  name: string;
  displayName: string;
  price: number;
  currency: string;
  aiPromptsPerDay: number | string;
  allowedExports: string[];
  features: {
    manualDrawing: boolean;
    validation: boolean;
    costModeling: boolean;
    voiceDiagram: boolean;
    integrations: boolean;
  };
}

export default function Settings() {
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [location, setLocation] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [currentPlan, setCurrentPlan] = useState<PlanInfo | null>(null);
  const { user, token, refreshUser } = useAuth();

  //  Get user info on page load
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/auth/getuser`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "auth-token": token || "",
          },
        });

        const data = await response.json();

        if (response.ok) {
          setEmail(data.email);
          setUsername(data.name || "");
          setLocation(data.location || "");
        }
      } catch {
        toast.error("Failed to load user data");
      }
    };

    fetchUser();
  }, []);

  // Fetch subscription plans to display current plan features
  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/subscription/plans`);
        if (res.data.success) {
          const userPlan = user?.subscription?.plan || "developer";
          const matched = res.data.plans.find(
            (p: PlanInfo) => p.name === userPlan,
          );
          if (matched) setCurrentPlan(matched);
        }
      } catch {
        // Silently fail — subscription card just won't show features
      }
    };

    fetchPlans();
  }, [user]);

  //
  // Update Profile
  //
  const handleProfileUpdate = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/auth/updateuser`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "auth-token": token || "",
        },
        body: JSON.stringify({ name: username, location }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Profile update failed");
        return;
      }
      await refreshUser();
      toast.success(data.message || "Profile updated successfully");
    } catch {
      toast.error("Server error");
    }
  };

  //
  // Change Password
  //
  const handlePasswordChange = async () => {
    if (newPassword.length < 5) {
      toast.error("New password must be at least 5 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "auth-token": token || "",
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Password change failed");
        return;
      }

      toast.success(data.message || "Password updated successfully");

      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Server error");
    }
  };

  //
  // Delete Account
  //
  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };
  const handleDeleteConfirm = async () => {
    setShowDeleteModal(false);

    const toastId = toast.loading("Deleting account...");
    try {
      const response = await fetch(`${API_BASE}/api/auth/deleteuser`, {
        method: "DELETE",
        headers: {
          "auth-token": token || "",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Delete failed");
        return;
      }

      toast.success(data.message || "Account deleted", { id: toastId });

      localStorage.removeItem("auth-token");
      window.location.href = "/login";
    } catch {
      toast.error("Server error");
    }
  };

  const featureLabels = [
    { key: "manualDrawing", label: "Manual & AI Drawing" },
    { key: "validation", label: "Model Validation" },
    { key: "costModeling", label: "Cost Modeling" },
    { key: "voiceDiagram", label: "Voice Commands" },
    { key: "integrations", label: "Confluence/GitHub Integration" },
  ] as const;

  return (
    <div className="settings-container">
      <h2 className="settings-page-title">Account Settings</h2>

      <div className="settings-grid">
        {/* Profile Card */}
        <div className="settings-card">
          <div className="card-header">
            <div className="card-icon profile-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h3>Profile</h3>
          </div>

          <div className="card-body">
            <label>Email</label>
            <input value={email} disabled className="input disabled" />

            <label>Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="input"
            />

            <label>Location</label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location"
              className="input"
            />

            <button onClick={handleProfileUpdate} className="primary-btn">
              Update Profile
            </button>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="settings-card subscription-card">
          <div className="card-header">
            <div className="card-icon subscription-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
            <h3>Subscription</h3>
          </div>

          <div className="card-body">
            <div className="plan-badge-row">
              <span
                className={`plan-label plan-label--${currentPlan?.name || "developer"}`}
              >
                {currentPlan?.displayName || "Free"}
              </span>
              {currentPlan && currentPlan.price > 0 && (
                <span className="plan-price-tag">
                  {currentPlan.currency === "EUR" ? "€" : ""}
                  {currentPlan.price}/mo
                </span>
              )}
            </div>

            {currentPlan && (
              <>
                <div className="plan-ai-limit">
                  <strong>
                    {currentPlan.aiPromptsPerDay === "unlimited"
                      ? "Unlimited"
                      : currentPlan.aiPromptsPerDay}
                  </strong>{" "}
                  AI Prompts / day
                </div>

                <ul className="plan-feature-list">
                  {featureLabels.map(({ key, label }) => {
                    const included = currentPlan.features[key];
                    return (
                      <li
                        key={key}
                        className={included ? "included" : "excluded"}
                      >
                        <span className="feature-check">
                          {included ? "✓" : "✗"}
                        </span>
                        {label}
                      </li>
                    );
                  })}
                </ul>

                <div className="plan-exports-row">
                  <span className="exports-label">Exports:</span>
                  {currentPlan.allowedExports.map((ext) => (
                    <span key={ext} className="export-chip">
                      {ext.toUpperCase()}
                    </span>
                  ))}
                </div>
              </>
            )}

            <Link to="/pricing" className="change-plan-link">
              Change Subscription Plan →
            </Link>
          </div>
        </div>

        {/* Password Card */}
        <div className="settings-card">
          <div className="card-header">
            <div className="card-icon password-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h3>Change Password</h3>
          </div>

          <div className="card-body">
            <div className="password-input-wrapper">
              <input
                type={showOldPassword ? "text" : "password"}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Old Password"
                className="input"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowOldPassword((prev) => !prev)}
              >
                {showOldPassword ? "🙈" : "👁"}
              </button>
            </div>

            <div className="password-input-wrapper">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New Password"
                className="input"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowNewPassword((prev) => !prev)}
              >
                {showNewPassword ? "🙈" : "👁"}
              </button>
            </div>

            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                className="input"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowConfirmPassword((prev) => !prev)}
              >
                {showConfirmPassword ? "🙈" : "👁"}
              </button>
            </div>

            <button onClick={handlePasswordChange} className="primary-btn">
              Change Password
            </button>
          </div>
        </div>

        {/* Delete Account Card */}
        <div className="settings-card delete-account-card">
          <div className="card-header">
            <div className="card-icon delete-account-icon">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3>Delete Account</h3>
          </div>

          <div className="card-body">
            <p className="delete-account-text">
              Once you delete your account, there is no going back. Please be
              certain.
            </p>
            <button className="delete-account-btn" onClick={handleDeleteClick}>
              Delete Account
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Account"
        message="Are you sure? This action cannot be undone."
      />
    </div>
  );
}
