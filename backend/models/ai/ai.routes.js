// backend/models/ai/ai.routes.js

const express = require("express");
const router = express.Router();
const aiService = require("./ai.service");
const fetchuser = require("../../middleware/fetchuser");
const checkAiUsage = require("../../middleware/checkAiUsage");
const User = require("../User");
const { getAIPromptsLimit } = require("../../config/subscriptionPlans");

// get curr prompt usage
router.get("/usage", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select(
      "aiUsage subscription",
    );
    if (!user) return res.status(404).json({ error: "User not found" });

    const planName = user.subscription?.plan || "developer";
    const limit = getAIPromptsLimit(planName);

    const today = new Date().setHours(0, 0, 0, 0);
    const lastPromptDate = user.aiUsage?.lastPromptDate
      ? new Date(user.aiUsage.lastPromptDate).setHours(0, 0, 0, 0)
      : null;

    let promptsUsed = user.aiUsage?.promptsUsedToday || 0;
    if (lastPromptDate !== today) {
      promptsUsed = 0;
    }

    res.json({
      success: true,
      used: promptsUsed,
      limit: limit === Infinity ? "unlimited" : limit,
      remaining:
        limit === Infinity ? "unlimited" : Math.max(0, limit - promptsUsed),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch AI usage" });
  }
});

router.post("/chat", fetchuser, checkAiUsage, async (req, res) => {
  try {
    const messages = req.body?.messages;
    const context = req.body?.context;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages[] is required" });
    }

    const result = await aiService.chat(messages, context);
    return res.json(result);
  } catch (err) {
    console.error("AI chat error:", err?.message || err);
    return res.status(500).json({
      error: "AI chat failed",
      details: err?.message || "Unknown error",
    });
  }
});

// convert image to base diagram
router.post("/image", fetchuser, checkAiUsage, async (req, res) => {
  try {
    const imageDataUrl = req.body?.imageDataUrl;
    const userPrompt = req.body?.userPrompt ?? "";
    const context = req.body?.context;

    if (!imageDataUrl || typeof imageDataUrl !== "string") {
      return res
        .status(400)
        .json({ error: "imageDataUrl (base64 data URL) is required" });
    }

    const result = await aiService.imageToDiagram(
      imageDataUrl,
      userPrompt,
      context,
    );
    return res.json(result);
  } catch (err) {
    console.error("AI image error:", err?.message || err);
    return res.status(500).json({
      error: "AI image-to-diagram failed",
      details: err?.message || "Unknown error",
    });
  }
});

router.post("/repair", fetchuser, checkAiUsage, async (req, res) => {
  try {
    const userPrompt = req.body?.userPrompt;
    const diagram = req.body?.diagram;
    const errors = req.body?.errors;

    if (!userPrompt || typeof userPrompt !== "string") {
      return res.status(400).json({ error: "userPrompt (string) is required" });
    }

    const result = await aiService.repair(userPrompt, diagram, errors);
    return res.json(result);
  } catch (err) {
    console.error("AI repair error:", err?.message || err);
    return res.status(500).json({
      error: "AI repair failed",
      details: err?.message || "Unknown error",
    });
  }
});

module.exports = router;
