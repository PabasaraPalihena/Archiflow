const request = require("supertest");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const app = require("../server");
const User = require("../models/User");

jest.mock("axios");

const JWT_SECRET = process.env.JWT_SECRET;
let token;
let user;

beforeEach(async () => {
  user = await User.create({
    name: "Integration Test User",
    email: "integration@example.com",
    password: "password123",
    location: "Test City",
    integrations: {
      confluence: {
        accessToken: "fake_conf_token",
        siteUrl: "https://test.atlassian.net",
        connectedAt: new Date(),
      },
      github: {
        accessToken: "fake_gh_token",
        username: "test_gh_user",
        connectedAt: new Date(),
      },
    },
  });

  const payload = { user: { id: user.id } };
  token = jwt.sign(payload, JWT_SECRET);
  axios.get.mockClear();
  axios.post.mockClear();
});

describe("Integration Routes", () => {
  // Confluence Tests
  describe("Confluence", () => {
    it("should return connected status if valid token", async () => {
      // Mock axios response for Atlassian validation
      axios.get.mockResolvedValueOnce({ data: {} });

      const res = await request(app)
        .get("/api/integrations/confluence/status")
        .set("auth-token", token);

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
      expect(res.body.siteUrl).toBe("https://test.atlassian.net");
    });

    it("should return disconnected if no token", async () => {
      // Create user without conf token
      const u2 = await User.create({
        name: "No Conf User",
        email: "nc@example.com",
        password: "123",
        location: "UK",
      });
      const t2 = jwt.sign({ user: { id: u2.id } }, JWT_SECRET);

      const res = await request(app)
        .get("/api/integrations/confluence/status")
        .set("auth-token", t2);

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(false);
    });

    it("should disconnect Confluence", async () => {
      const res = await request(app)
        .post("/api/integrations/confluence/disconnect")
        .set("auth-token", token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedUser = await User.findById(user.id);
      expect(updatedUser.integrations.confluence.accessToken).toBeNull();
    });
  });

  // GitHub Tests
  describe("GitHub", () => {
    it("should return connected status if valid token", async () => {
      // Mock axios github user fetch
      axios.get.mockResolvedValueOnce({
        data: { login: "test_gh_user", avatar_url: "url" },
      });

      const res = await request(app)
        .get("/api/integrations/github/status")
        .set("auth-token", token);

      expect(res.status).toBe(200);
      expect(res.body.connected).toBe(true);
      expect(res.body.username).toBe("test_gh_user");
    });

    it("should disconnect GitHub", async () => {
      const res = await request(app)
        .post("/api/integrations/github/disconnect")
        .set("auth-token", token);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedUser = await User.findById(user.id);
      expect(updatedUser.integrations.github.accessToken).toBeNull();
    });
  });
});
