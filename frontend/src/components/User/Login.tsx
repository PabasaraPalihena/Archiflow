import React, { useState } from "react";
import axios from "axios";
import "./Login.css";
import illustration from "../../assets/login_illustration.png";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import toast from "react-hot-toast";
import { BiFontColor } from "react-icons/bi";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

const Login: React.FC = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Get the page user was trying to access before being redirected to login
  const from = (location.state as any)?.from?.pathname || "/maincanvas";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setLoading(true);

      const res = await axios.post(`${API_BASE}/api/auth/login`, {
        email,
        password,
      });

      if (res.data.success) {
        // Use auth context to login and fetch user data
        await login(res.data.authtoken);
        toast.success("Logged in successfully");
        setTimeout(() => navigate(from, { replace: true }), 300);
      } else {
        toast.error("Invalid credentials");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authPage">
      {/* Blurred background image */}
      <div className="auth-bg">
        <img src={illustration} alt="" className="auth-bg-img" />
      </div>

      <div className="auth-card">
        {/* LEFT: login content */}
        <div className="left">
          <img
            src="public/logonobg.png"
            alt="ArchiFlow Logo"
            className="logo"
            style={{ width: "clamp(140px, 20vw, 210px)", height: "auto" }}
          />
          <h1 className="title">Login</h1>
          <form className="form" onSubmit={handleSubmit}>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <div className="password-row">
              <label>Password</label>
              <button
                type="button"
                className="forgot-btn"
                onClick={() => navigate("/forgot-password")}
              >
                Forgot Password?
              </button>
            </div>
            {/* PASSWORD INPUT + EYE TOGGLE */}
            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((prev) => !prev)}
              >
                {showPassword ? "🙈" : "👁"}
              </button>
            </div>
            <div className="form-actions">
              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? "LOGGING IN..." : "LOGIN →"}
              </button>
              <p className="signup-text">
                Don’t have an account yet?{" "}
                <Link to="/signup" className="link">
                  Sign up for free
                </Link>
              </p>
            </div>
          </form>
        </div>
        {/* RIGHT: illustration */}
        <div className="right">
          <img
            src={illustration}
            alt="Girl working on laptop"
            className="hero"
          />
        </div>
      </div>
    </div>
  );
};

export default Login;
