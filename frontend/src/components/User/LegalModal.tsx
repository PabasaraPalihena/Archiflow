import React from "react";
import "./LegalModal.css";

type LegalModalProps = {
  isOpen: boolean;
  onClose: () => void;
  type: "terms" | "privacy";
};

const PRODUCT_NAME = "ArchiFlow";

const termsContent = (
  <>
    <p className="legal-updated">Last updated: March 2026</p>

    <h3>1. Scope of Service</h3>
    <p>
      {PRODUCT_NAME} is an architecture diagramming tool that runs locally on
      your device. By creating an account and using {PRODUCT_NAME}, you agree to
      these Terms and Conditions.
    </p>

    <h3>2. Account &amp; Usage</h3>
    <p>
      You are responsible for maintaining the confidentiality of your account
      credentials. You agree to use {PRODUCT_NAME} only for lawful purposes and
      in compliance with all applicable laws.
    </p>

    <h3>3. AI-Powered Features</h3>
    <p>
      {PRODUCT_NAME} includes an AI chatbot powered by OpenAI. When you use this
      feature, the prompts and context you provide are sent to OpenAI's API for
      processing. AI-generated outputs are provided "as-is" and should be
      reviewed before use. You retain ownership of your inputs and any diagrams
      you create.
    </p>

    <h3>4. Intellectual Property</h3>
    <p>
      All diagrams, documents, and content you create with {PRODUCT_NAME} belong
      to you. The {PRODUCT_NAME} software, branding, and interface are the
      intellectual property of the {PRODUCT_NAME} team and are protected by
      applicable copyright and trademark laws.
    </p>

    <h3>5. Limitation of Liability</h3>
    <p>
      {PRODUCT_NAME} is provided "as is" without warranties of any kind, express
      or implied. To the maximum extent permitted by law, {PRODUCT_NAME} shall
      not be liable for any indirect, incidental, or consequential damages
      arising from the use or inability to use the service.
    </p>

    <h3>6. Termination</h3>
    <p>
      You may delete your account and all associated data at any time through
      the application settings. Since {PRODUCT_NAME} is hosted on your device,
      all data remains under your control.
    </p>

    <h3>7. Changes to Terms</h3>
    <p>
      We may update these terms from time to time. Continued use of{" "}
      {PRODUCT_NAME} after changes constitutes acceptance of the updated terms.
    </p>

    <h3>8. Governing Law</h3>
    <p>
      These terms are governed by the laws of the Federal Republic of Germany.
      The courts of Germany shall have exclusive jurisdiction over any disputes
      arising from these terms.
    </p>
  </>
);

const privacyContent = (
  <>
    <p className="legal-updated">Last updated: March 2026</p>

    <h3>1. Data Controller</h3>
    <p>
      The data controller for {PRODUCT_NAME} is the {PRODUCT_NAME} team. For
      any privacy-related inquiries, please contact us through the application's
      support channels.
    </p>

    <h3>2. Data We Collect</h3>
    <ul>
      <li>
        <strong>Account data:</strong> Name, email address, location, and
        password (stored as a secure hash). All account data is stored locally
        on your device and is not transmitted to any external service.
      </li>
      <li>
        <strong>Diagram data:</strong> Diagrams and project files you create are
        stored entirely on your device.
      </li>
      <li>
        <strong>AI interaction data:</strong> When you use the AI chatbot, your
        chat messages, diagram data, and any uploaded images are sent to OpenAI
        for processing (see Section 5). Your account information (name, email,
        location) is never sent to OpenAI.
      </li>
    </ul>

    <h3>3. Legal Basis for Processing (GDPR Art. 6)</h3>
    <ul>
      <li>
        <strong>Contract performance (Art. 6(1)(b)):</strong> Processing your
        account data locally is necessary to provide the service.
      </li>
      <li>
        <strong>Consent (Art. 6(1)(a)):</strong> When you use the AI chatbot,
        you consent to your chat messages and diagram data being sent to OpenAI
        for processing.
      </li>
    </ul>

    <h3>4. Data Storage &amp; Security</h3>
    <p>
      {PRODUCT_NAME} is fully self-hosted and runs entirely on your device. All
      your data — account information, diagrams, and project files — is stored
      locally on your hardware. No data is stored on external servers. Your
      password is stored as a secure hash. We do not sell, share, or transfer
      your data to third parties, except when you explicitly use the AI chatbot
      feature (see Section 5).
    </p>

    <h3>5. Third-Party Data Processing — OpenAI</h3>
    <p>
      Our AI chatbot feature uses the OpenAI API. When you use this feature,
      the following data is transmitted to OpenAI's servers:
    </p>
    <ul>
      <li>Your chat messages and prompts</li>
      <li>Diagram data (structure and content) for context</li>
      <li>Uploaded images (when using image-to-diagram conversion)</li>
    </ul>
    <p>
      Your personal account information (name, email, location, password) is
      never sent to OpenAI. OpenAI processes this data in accordance with
      their{" "}
      <a
        href="https://openai.com/policies/privacy-policy"
        target="_blank"
        rel="noopener noreferrer"
      >
        Privacy Policy
      </a>{" "}
      and{" "}
      <a
        href="https://openai.com/policies/terms-of-use"
        target="_blank"
        rel="noopener noreferrer"
      >
        Terms of Use
      </a>
      . Data sent to OpenAI via the API is not used to train their models.
      OpenAI may process data outside the EU/EEA; appropriate safeguards
      (Standard Contractual Clauses) are in place.
    </p>

    <h3>6. Your Rights (GDPR Art. 15–21)</h3>
    <p>
      Since {PRODUCT_NAME} is self-hosted, your data is under your direct
      control. You can:
    </p>
    <ul>
      <li>
        <strong>Access &amp; export</strong> all your data directly from the
        application
      </li>
      <li>
        <strong>Rectify</strong> your account information through the settings
      </li>
      <li>
        <strong>Delete</strong> your account and all associated data at any time
      </li>
    </ul>
    <p>
      Under the GDPR, you also have the right to lodge a complaint with a
      supervisory authority if you believe your data has been processed
      unlawfully.
    </p>

    <h3>7. Data Retention</h3>
    <p>
      All data is stored locally on your device and remains under your control.
      When you delete your account, all associated data is removed from your
      device. Data previously sent to OpenAI during AI chatbot usage is subject
      to OpenAI's data retention policies.
    </p>

    <h3>8. Cookies &amp; Tracking</h3>
    <p>
      {PRODUCT_NAME} uses only essential cookies required for authentication and
      session management. We do not use tracking cookies, analytics, or
      advertising cookies.
    </p>

    <h3>9. Changes to This Policy</h3>
    <p>
      We may update this privacy policy to reflect changes in our practices or
      legal requirements. We will notify you of significant changes through the
      application.
    </p>
  </>
);

export default function LegalModal({ isOpen, onClose, type }: LegalModalProps) {
  if (!isOpen) return null;

  const title = type === "terms" ? "Terms & Conditions" : "Privacy Policy";
  const content = type === "terms" ? termsContent : privacyContent;

  return (
    <div className="legal-overlay" onClick={onClose}>
      <div className="legal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="legal-header">
          <h2>{title}</h2>
          <button className="legal-close" onClick={onClose} aria-label="Close">
            &times;
          </button>
        </div>
        <div className="legal-body">{content}</div>
        <div className="legal-footer">
          <button className="legal-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
