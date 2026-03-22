const request = require("supertest");
const jwt = require("jsonwebtoken");
const app = require("../server");
const User = require("../models/User");

const JWT_SECRET = process.env.JWT_SECRET;
let token;
let user;

beforeEach(async () => {
  user = await User.create({
    name: "Subscription Test User",
    email: "sub@example.com",
    password: "password123",
    location: "Test City",
  });

  const payload = { user: { id: user.id } };
  token = jwt.sign(payload, JWT_SECRET);
});

describe("Subscription Routes", () => {
  it("should retrieve all available plans publicly", async () => {
    const res = await request(app).get("/api/subscription/plans");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Should have multiple plans, checking for at least 'developer'
    expect(res.body.plans.some((p) => p.name === "developer")).toBe(true);
    expect(res.body.plans.some((p) => p.name === "enterprise")).toBe(true);
  });

  it("should retrieve the user current plan", async () => {
    const res = await request(app)
      .get("/api/subscription/my-plan")
      .set("auth-token", token);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.currentPlan).toBe("developer");
  });

  it("should upgrade the user plan", async () => {
    const res = await request(app)
      .put("/api/subscription/upgrade")
      .set("auth-token", token)
      .send({ plan: "professional" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.currentPlan).toBe("professional");

    // Verify db change
    const updatedUser = await User.findById(user.id);
    expect(updatedUser.subscription.plan).toBe("professional");
  });

  it("should not upgrade to an invalid plan", async () => {
    const res = await request(app)
      .put("/api/subscription/upgrade")
      .set("auth-token", token)
      .send({ plan: "hacker" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should not upgrade if already on the same plan", async () => {
    // Upgrade to professional first
    await request(app)
      .put("/api/subscription/upgrade")
      .set("auth-token", token)
      .send({ plan: "professional" });

    // Try upgrading again
    const res = await request(app)
      .put("/api/subscription/upgrade")
      .set("auth-token", token)
      .send({ plan: "professional" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("You are already on the professional plan.");
  });
});
