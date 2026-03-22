import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import "./App.css";
import { Toaster } from "react-hot-toast";
import EditorLayout from "./components/Canvas/EditorLayout";
import Header from "./components/Common/Header";
import Footer from "./components/Common/Footer";
import Signup from "./components/User/Signup";
import ForgotPassword from "./components/User/ForgotPassword";
import Login from "./components/User/Login";
import MyDiagrams from "./components/User/MyDiagrams";
import ChatWidget from "./components/chat/ChatWidget";
import type { AiDiagram } from "./components/Canvas/MainCanvas";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/Common/ProtectedRoute";
import IntegrationsPage from "./components/Integrations/IntegrationsPage";
import PricingPage from "./components/Subscription/PricingPage";
import UpgradeModal from "./components/Subscription/UpgradeModal";
import Settings from "./components/Settings/Settings";
import FAQ from "./components/FAQ/FAQ";
import DocsPage from "./components/Docs/DocsPage";
import ConfirmModal from "./components/ConfirmModal/ConfirmModal";

function AppContent() {
  const [chatOpen, setChatOpen] = useState(false);
  const [aiDiagram, setAiDiagram] = useState<AiDiagram | null>(null);
  const location = useLocation();

  //key: Header click triggers validation run inside EditorLayout
  const [validateNonce, setValidateNonce] = useState(0);
  // Cost estimate trigger
  const [costEstimateNonce, setCostEstimateNonce] = useState(0);
  // Canvas node count – used to enable/disable validation button
  const [canvasNodeCount, setCanvasNodeCount] = useState(0);
  // Track whether canvas has unsaved changes
  const [canvasDirty, setCanvasDirty] = useState(true);
  const [upgradeModalConfig, setUpgradeModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    feature: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    feature: "",
  });

  // Reset nonces when navigating away from canvas so they don't
  // re-trigger modals when EditorLayout remounts
  const isCanvasRoute =
    location.pathname === "/" || location.pathname === "/maincanvas";
  useEffect(() => {
    if (!isCanvasRoute) {
      setValidateNonce(0);
      setCostEstimateNonce(0);
    }
  }, [isCanvasRoute]);

  // Pending navigation for unsaved changes guard
  const [pendingPath, setPendingPath] = useState<string | null>(null);

  // Hide header on auth pages
  const authPages = [
    "/login",
    "/signup",
    "/forgot-password",
    "/otp",
    "/new-password",
  ];
  const showHeader = !authPages.includes(location.pathname);
  const navigate = useNavigate();

  const guardedNavigate = useCallback(
    (path: string) => {
      if (isCanvasRoute && canvasNodeCount > 0 && canvasDirty && path !== "/maincanvas") {
        setPendingPath(path);
      } else {
        navigate(path);
      }
    },
    [isCanvasRoute, canvasNodeCount, canvasDirty, navigate],
  );

  const { user } = useAuth();

  const handleCostEstimateClick = () => {
    if (user?.subscription?.plan === "developer") {
      setUpgradeModalConfig({
        isOpen: true,
        title: "Upgrade the Plan to Access Cost Modeling",
        message:
          "Cost Modeling allows you to estimate project costs directly on your diagram. Upgrade to the Standard or Premium plan to unlock this and other advanced features.",
        feature: "Cost Modeling",
      });
    } else {
      setCostEstimateNonce((n) => n + 1);
    }
  };

  const handleIntegrationsClick = () => {
    if (user?.subscription?.plan !== "enterprise") {
      setUpgradeModalConfig({
        isOpen: true,
        title: "Upgrade to Premium for Integrations",
        message:
          "Connect ArchiFlow with Jira, GitHub, and more to sync your architecture with your development workflow. This feature is exclusive to our Premium Plan.",
        feature: "Integrations",
      });
    } else {
      guardedNavigate("/integrations");
    }
  };

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            borderRadius: "12px",
            background: "#111827",
            color: "#fff",
            padding: "16px 20px",
            fontSize: "14px",
          },
        }}
      />
      <UpgradeModal
        isOpen={upgradeModalConfig.isOpen}
        onClose={() =>
          setUpgradeModalConfig((prev) => ({ ...prev, isOpen: false }))
        }
        title={upgradeModalConfig.title}
        message={upgradeModalConfig.message}
        featureName={upgradeModalConfig.feature}
      />
      {showHeader && (
        <Header
          onChatClick={() => setChatOpen(true)}
          onValidationClick={() => setValidateNonce((n) => n + 1)}
          onCostEstimateClick={handleCostEstimateClick}
          onIntegrationsClick={handleIntegrationsClick}
          canvasHasNodes={canvasNodeCount > 0}
          onNavigate={guardedNavigate}
        />
      )}
      <ConfirmModal
        isOpen={pendingPath !== null}
        title="Unsaved Changes"
        message="You have unsaved changes on the canvas. Are you sure you want to leave? Your diagram will be lost."
        confirmLabel="Leave"
        onClose={() => setPendingPath(null)}
        onConfirm={() => {
          const path = pendingPath!;
          setPendingPath(null);
          navigate(path);
        }}
      />

      <Routes>
        {/* Protected routes - require login */}
        <Route path="/" element={<Navigate to="/maincanvas" replace />} />
        <Route
          path="/faq"
          element={
            <ProtectedRoute>
              <FAQ />
            </ProtectedRoute>
          }
        />
        <Route
          path="/docs"
          element={
            <ProtectedRoute>
              <DocsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/maincanvas"
          element={
            <ProtectedRoute>
              <EditorLayout
                externalDiagram={aiDiagram}
                validateNonce={validateNonce}
                costEstimateNonce={costEstimateNonce}
                onImport={(diagram) => setAiDiagram(diagram)}
                onNodeCountChange={setCanvasNodeCount}
                onDirtyChange={setCanvasDirty}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-diagrams"
          element={
            <ProtectedRoute>
              <MyDiagrams onLoadDiagram={(d) => setAiDiagram(d)} />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/integrations"
          element={
            <ProtectedRoute>
              <IntegrationsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/pricing"
          element={
            <ProtectedRoute>
              <PricingPage />
            </ProtectedRoute>
          }
        />

        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Routes>

      <Footer />

      <ChatWidget
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        onApplyDiagram={(d: AiDiagram) => {
          setAiDiagram(d);
          setChatOpen(false);
        }}
      />
    </>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;
