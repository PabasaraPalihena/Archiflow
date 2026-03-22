const express = require("express");
const router = express.Router();
const User = require("../models/User");
const fetchuser = require("../middleware/fetchuser");
const { SUBSCRIPTION_PLANS, getPlan } = require("../config/subscriptionPlans");

// GET /api/subscription/plans — public, return all plans
router.get("/plans", (_req, res) => {
  // Replace Infinity with "unlimited" for JSON serialisation
  const plans = Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => ({
    ...plan,
    name: key,
    aiPromptsPerDay:
      plan.aiPromptsPerDay === Infinity ? "unlimited" : plan.aiPromptsPerDay,
  }));
  res.json({ success: true, plans });
});

// GET /api/subscription/my-plan — auth required
router.get("/my-plan", fetchuser, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("subscription");
    const planName = user?.subscription?.plan || "developer";
    const plan = getPlan(planName);
    res.json({
      success: true,
      currentPlan: planName,
      plan: {
        ...plan,
        aiPromptsPerDay:
          plan.aiPromptsPerDay === Infinity
            ? "unlimited"
            : plan.aiPromptsPerDay,
      },
      upgradedAt: user?.subscription?.upgradedAt || null,
    });
  } catch (error) {
    console.error("my-plan error:", error.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// PUT /api/subscription/upgrade — auth required
router.put("/upgrade", fetchuser, async (req, res) => {
  const { plan } = req.body;

  if (!["developer", "professional", "enterprise"].includes(plan)) {
    return res.status(400).json({
      success: false,
      error: "Invalid plan. Choose developer, professional, or enterprise.",
    });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    const currentPlan = user.subscription?.plan || "developer";
    if (currentPlan === plan) {
      return res.status(400).json({
        success: false,
        error: `You are already on the ${plan} plan.`,
      });
    }

    user.subscription = {
      plan,
      upgradedAt: new Date(),
    };
    await user.save();

    const updatedPlan = getPlan(plan);
    res.json({
      success: true,
      message: `Successfully switched to ${updatedPlan.displayName}`,
      currentPlan: plan,
      plan: {
        ...updatedPlan,
        aiPromptsPerDay:
          updatedPlan.aiPromptsPerDay === Infinity
            ? "unlimited"
            : updatedPlan.aiPromptsPerDay,
      },
    });
  } catch (error) {
    console.error("upgrade error:", error.message);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;
