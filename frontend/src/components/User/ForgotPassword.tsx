import React, { useEffect, useState } from "react";
import axios from "axios";
import "./ForgotPassword.css";
import forgotPwIllustration from "../../assets/forgot_password_illustration.png";
import otpIllustration from "../../assets/otp_illustration.png";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

const API_BASE = import.meta.env.VITE_API_BASE_URL;

// ForgotPassword component
const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // make sure fields start empty whenever this page loads
  useEffect(() => {
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  }, []);

  // STEP 1 – request OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.post(
        `${API_BASE}/api/auth/request-password-reset`,
        { email },
      );
      if (res.data.success) {
        setOtpSent(true);
        setOtp("");
        setNewPassword("");
        setConfirmPassword("");
        toast.success("OTP sent to your email");
      } else {
        toast.error(res.data.error || "Could not send OTP.");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Could not send OTP.");
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 – reset password using OTP
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      toast.error("Please enter the OTP you received.");
      return;
    }
    if (newPassword.length < 5) {
      toast.error("Password must be at least 5 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    try {
      setLoading(true);
      const res = await axios.put(`${API_BASE}/api/auth/reset-password`, {
        email,
        otp,
        newPassword,
      });
      if (res.data.success) {
        toast.success("Password updated successfully");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        toast.error(res.data.error || "Could not reset password.");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Could not reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="authPage">
      {/* Blurred background image */}
      <div className="auth-bg">
        <img src={otpIllustration} alt="" className="auth-bg-img" />
      </div>
      <div className="auth-card">
        {/* LEFT: content */}
        <div className="left">
          <img
            src="public/logonobg.png"
            alt="ArchiFlow Logo"
            className="logo"
            style={{ width: "clamp(140px, 20vw, 210px)", height: "auto" }}
          />

          <h1 className="title">Forgot Password</h1>

          <form
            className="form"
            onSubmit={otpSent ? handleResetPassword : handleRequestOtp}
            autoComplete="off"
          >
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={otpSent}
            />

            {otpSent && (
              <>
                <label>OTP code</label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />

                <label>New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />

                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                />
              </>
            )}

            <div className="form-actions">
              <button className="login-btn" type="submit" disabled={loading}>
                {otpSent
                  ? loading
                    ? "UPDATING..."
                    : "RESET PASSWORD →"
                  : loading
                    ? "SENDING OTP..."
                    : "SEND OTP →"}
              </button>

              <p className="signup-text">
                Remember your password?{" "}
                <Link to="/login" className="link">
                  Back to login
                </Link>
              </p>
            </div>
          </form>
        </div>

        {/* RIGHT: illustration */}
        <div className="right">
          <div className="hero-wrap">
            <img
              src={otpSent ? otpIllustration : forgotPwIllustration}
              alt={
                otpSent
                  ? "OTP verification illustration"
                  : "Password reset illustration"
              }
              className="hero"
              style={{ transition: "opacity 0.4s ease" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
