const User = require("../models/User");
const { getAIPromptsLimit } = require("../config/subscriptionPlans");

// check and increment ai prompt usage
// resets daily
const checkAiUsage = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const planName = user.subscription?.plan || "developer";
    const limit = getAIPromptsLimit(planName);

    // unlimited for enterprise users
    if (limit === Infinity) {
      return next();
    }

    const today = new Date().setHours(0, 0, 0, 0);
    const lastPromptDate = user.aiUsage?.lastPromptDate
      ? new Date(user.aiUsage.lastPromptDate).setHours(0, 0, 0, 0)
      : null;

    let promptsUsed = user.aiUsage?.promptsUsedToday || 0;

    // reset count daily
    if (lastPromptDate !== today) {
      promptsUsed = 0;
    }

    if (promptsUsed >= limit) {
      return res.status(403).json({
        error: "Daily AI prompt limit reached",
        limit,
        plan: planName,
        message: `Your current ${planName} plan allows ${limit} prompts per day. Please upgrade for more.`,
      });
    }

    // increment used prompts
    user.aiUsage = {
      promptsUsedToday: promptsUsed + 1,
      lastPromptDate: new Date(),
    };
    await user.save();

    // attach usage to req for the client
    req.aiUsage = {
      used: promptsUsed + 1,
      limit,
    };

    next();
  } catch (err) {
    console.error("AI usage check error:", err.message);
    res.status(500).json({ error: "Failed to verify AI usage" });
  }
};

module.exports = checkAiUsage;
