import React from "react";
import { X, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  featureName?: string;
}

const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  onClose,
  title = "Unlock Premium Feature",
  message = "This feature is available in our paid plans. Upgrade now to get full access and enhance your architecture design workflow.",
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="mdConfirmOverlay" onClick={onClose}>
      <div
        className="mdConfirmDialog !p-0 overflow-hidden w-[480px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="upgrade-header relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:opacity-70 transition-opacity bg-transparent border-none cursor-pointer"
          >
            <X size={20} />
          </button>

          <h2 className="upgrade-title pr-8">
            <Sparkles className="text-yellow-300 flex-shrink-0" size={24} />
            {title}
          </h2>
        </div>

        {/* Content */}
        <div className="upgrade-content">
          <p className="upgrade-message">{message}</p>

          <div className="flex flex-col gap-3">
            <button
              className="upgrade-btn-primary w-full"
              onClick={() => {
                onClose();
                navigate("/pricing");
              }}
            >
              View Pricing & Plans
            </button>
            <button className="upgrade-btn-secondary w-full" onClick={onClose}>
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
