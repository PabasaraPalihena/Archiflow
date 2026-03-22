import React, { useState } from "react";
import axios from "axios";
import "./Signup.css";
import illustration from "../../assets/signup_illustration.png";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import LegalModal from "./LegalModal";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const Signup: React.FC = () => {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agree, setAgree] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [legalModal, setLegalModal] = useState<"terms" | "privacy" | null>(null);

  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agree) {
      toast.error("Please accept the terms and privacy policies.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 5) {
      toast.error("Password must be at least 5 characters.");
      return;
    }

    try {
      setLoading(true);

      const res = await axios.post(`${API_BASE}/api/auth/createuser`, {
        name,
        email,
        password,
        location,
      });

      if (res.data.success) {
        // Use auth context to login and fetch user data
        await login(res.data.authtoken);
        toast.success("Account created successfully! Redirecting...");
        setTimeout(() => navigate("/", { replace: true }), 500);
      } else {
        toast.error(res.data.error || "Signup failed.");
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.error ||
        err.response?.data?.errors?.[0]?.msg ||
        "Signup failed.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signupPage">
      {/* Blurred background image */}
      <div className="auth-bg">
        <img src={illustration} alt="" className="auth-bg-img" />
      </div>

      <div className="signup-card">
        {/* LEFT: form content */}
        <div className="left">
          <img src="public/logonobg.png" alt="ArchiFlow Logo" className="logo" style={{ width: "clamp(140px, 20vw, 210px)", height: "auto" }}/>
          <h1 className="title">Sign up</h1>

          <form className="form" onSubmit={handleSubmit} autoComplete="off">
            <label>
              Full Name
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>

            <label>
              Location
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                required
              />
            </label>

            <div className="password-row-2col">
              <div className="password-group">
                <label>
                  Password
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label="Toggle password visibility"
                    >
                      {showPassword ? "\uD83D\uDE48" : "\uD83D\uDC41"}
                    </button>
                  </div>
                </label>
              </div>

              <div className="password-group">
                <label>
                  Confirm Password
                  <div className="password-input-wrapper">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label="Toggle confirm password visibility"
                    >
                      {showConfirmPassword ? "\uD83D\uDE48" : "\uD83D\uDC41"}
                    </button>
                  </div>
                </label>
              </div>
            </div>

            <div className="signup-terms">
              <label className="signup-terms-label">
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                />
                <span>
                  I agree to all the{" "}
                  <span className="link-highlight" onClick={() => setLegalModal("terms")} role="button" tabIndex={0}>Terms</span> and{" "}
                  <span className="link-highlight" onClick={() => setLegalModal("privacy")} role="button" tabIndex={0}>Privacy Policies</span>
                </span>
              </label>
            </div>

            <div className="form-actions">
              <button className="signup-btn" type="submit" disabled={loading}>
                {loading ? "CREATING..." : "SIGN UP \u2192"}
              </button>

              <p className="login-text">
                Already have an account?{" "}
                <Link to="/login" className="link">
                  Login
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* RIGHT: illustration */}
        <div className="right">
          <img
            src={illustration}
            alt="Secure signup illustration"
            className="hero"
          />
        </div>
      </div>

      <LegalModal
        isOpen={legalModal !== null}
        onClose={() => setLegalModal(null)}
        type={legalModal ?? "terms"}
      />
    </div>
  );
};

export default Signup;
