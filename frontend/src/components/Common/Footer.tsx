import React from "react";
import { useLocation } from "react-router-dom";
import archiflowIcon from "../../assets/archiflow-icon.png";
import "./Footer.css";

const Footer: React.FC = () => {
  const location = useLocation();
  const currentYear = new Date().getFullYear();

  // Hide footer on canvas and auth pages
  const hiddenRoutes = ["/maincanvas", "/login", "/signup", "/forgot-password"];
  if (
    hiddenRoutes.includes(location.pathname) ||
    location.pathname === "/"
  ) {
    return null;
  }

  return (
    <footer className="footer">
      <div className="footer-inner">
        {/* Brand column */}
        <div className="footer-brand">
          <div className="footer-logo-row">
            <img src={archiflowIcon} alt="ArchiFlow" className="footer-logo" />
            <span className="footer-logo-text">ArchiFlow</span>
          </div>
          <p className="footer-tagline">
            Design, validate, and collaborate on software architecture diagrams.
          </p>
        </div>

        {/* Product column */}
        <div className="footer-col">
          <h4 className="footer-col-title">Product</h4>
          <a href="/maincanvas" className="footer-link">Canvas</a>
          <a href="/my-diagrams" className="footer-link">My Diagrams</a>
          <a href="/pricing" className="footer-link">Pricing</a>
          <a href="/integrations" className="footer-link">Integrations</a>
        </div>

        {/* Resources column */}
        <div className="footer-col">
          <h4 className="footer-col-title">Resources</h4>
          <a href="/faq" className="footer-link">FAQ</a>
          <a href="/docs" className="footer-link">Documentation</a>
          <a href="/settings" className="footer-link">Settings</a>
        </div>

        {/* Company column */}
        <div className="footer-col">
          <h4 className="footer-col-title">Team</h4>
          <span className="footer-text">MarxDev</span>
          <span className="footer-text">TU Chemnitz</span>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="footer-bottom">
        <span className="footer-copyright">
          &copy; {currentYear} MarxDev. All rights reserved.
        </span>
        <div className="footer-bottom-links">
          <span className="footer-separator">·</span>
          <span className="footer-built">
            Built with care in Chemnitz
          </span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
