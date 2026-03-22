import React, { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import "./Header.css";
import archiflowIcon from "../../assets/archiflow-icon.png";

type HeaderProps = {
  onChatClick: () => void;
  onValidationClick: () => void;
  onCostEstimateClick: () => void;
  onIntegrationsClick: () => void;
  canvasHasNodes?: boolean;
  onNavigate: (path: string) => void;
};

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

const Header: React.FC<HeaderProps> = ({
  onChatClick,
  onValidationClick,
  onCostEstimateClick,
  onIntegrationsClick,
  canvasHasNodes = false,
  onNavigate,
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const guardedNavigate = onNavigate;
  const location = useLocation();
  const isCanvas =
    location.pathname === "/" || location.pathname === "/maincanvas";
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const initials = user?.name ? getInitials(user.name) : "??";

  return (
    <header className="header">
      <div
        className="header-left"
        onClick={() => guardedNavigate("/maincanvas")}
        style={{ cursor: "pointer" }}
      >
        <img src={archiflowIcon} alt="ArchiFlow" className="header-logo" />
        <span className="logo-text">ArchiFlow</span>
      </div>

      <div className="header-right">
        {isCanvas && (
          <button className="header-btn" onClick={onCostEstimateClick}>
            Cost Estimate
          </button>
        )}

        {isCanvas && (
          <button
            className={`header-btn${!canvasHasNodes ? " disabled" : ""}`}
            onClick={canvasHasNodes ? onValidationClick : undefined}
            disabled={!canvasHasNodes}
            title={!canvasHasNodes ? "Add elements to the canvas first" : "Validate diagram"}
          >
            Validation
          </button>
        )}

        <button className="header-btn primary" onClick={onChatClick}>
          Chat with us
        </button>

        {/* Profile dropdown */}
        <div className="profile-wrapper" ref={dropdownRef}>
          <div
            className="profile-circle"
            onClick={() => setDropdownOpen((prev) => !prev)}
            title={user?.name || "User"}
          >
            <span className="profile-text">{initials}</span>
          </div>

          {dropdownOpen && (
            <div className="profile-dropdown">
              <div className="profile-dropdown-header">
                <div className="profile-dropdown-avatar">{initials}</div>
                <div className="profile-dropdown-info">
                  <span className="profile-dropdown-name">
                    {user?.name || "User"}
                    {user?.subscription?.plan && (
                      <span
                        className={`plan-badge-small ${user.subscription.plan}`}
                      >
                        {user.subscription.plan}
                      </span>
                    )}
                  </span>
                  <span className="profile-dropdown-email">
                    {user?.email || ""}
                  </span>
                </div>
              </div>
              <div className="profile-dropdown-divider" />
              <button
                className="profile-dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  guardedNavigate("/pricing");
                }}
              >
                Pricing & Plans
              </button>
              <button
                className="profile-dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  onIntegrationsClick();
                }}
              >
                Integrations
              </button>
              <button
                className="profile-dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  guardedNavigate("/my-diagrams");
                }}
              >
                My Diagrams
              </button>
              <button
                className="profile-dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  guardedNavigate("/settings");
                }}
              >
                Settings
              </button>
              <button
                className="profile-dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  guardedNavigate("/faq");
                }}
              >
                FAQ
              </button>
              <button
                className="profile-dropdown-item"
                onClick={() => {
                  setDropdownOpen(false);
                  guardedNavigate("/docs");
                }}
              >
                Documentation
              </button>
              <button className="profile-dropdown-item" onClick={handleLogout}>
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
