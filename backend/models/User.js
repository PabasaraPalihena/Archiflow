const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  resetOtp: {
    type: String,
  },
  resetOtpExpire: {
    type: Date,
  },
  myDiagrams: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Diagram",
    },
  ],
  integrations: {
    confluence: {
      accessToken: { type: String, default: null },
      refreshToken: { type: String, default: null },
      cloudId: { type: String, default: null },
      siteUrl: { type: String, default: null },
      connectedAt: { type: Date, default: null },
    },
    github: {
      accessToken: { type: String, default: null },
      username: { type: String, default: null },
      connectedAt: { type: Date, default: null },
    },
  },
  aiUsage: {
    promptsUsedToday: { type: Number, default: 0 },
    lastPromptDate: { type: Date, default: null },
  },
  subscription: {
    plan: {
      type: String,
      enum: ["developer", "professional", "enterprise"],
      default: "developer",
    },
    upgradedAt: { type: Date, default: null },
  },
});

module.exports = mongoose.model("user", UserSchema);
