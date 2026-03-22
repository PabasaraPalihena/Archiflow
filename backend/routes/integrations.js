const express = require("express");
const router = express.Router();
const axios = require("axios");
const FormData = require("form-data");
const auth = require("../middleware/fetchuser");
const User = require("../models/User");

// CONFLUENCE INTEGRATION

// Confluence OAuth Configuration (Atlassian Cloud)
const CONFLUENCE_CLIENT_ID = process.env.CONFLUENCE_CLIENT_ID;
const CONFLUENCE_CLIENT_SECRET = process.env.CONFLUENCE_CLIENT_SECRET;
const CONFLUENCE_REDIRECT_URI =
  process.env.CONFLUENCE_REDIRECT_URI ||
  "http://localhost:5000/api/integrations/confluence/callback";

const CONFLUENCE_SCOPES = [
  "read:space:confluence",
  "read:page:confluence",
  "write:page:confluence",
  "offline_access",
].join(" ");

// @route   GET /api/integrations/confluence/status
// @desc    Check Confluence connection status
// @access  Private
router.get("/confluence/status", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const conf = user.integrations?.confluence;

    if (!conf?.accessToken) {
      return res.json({
        connected: false,
        message: "Confluence is not connected",
      });
    }

    try {
      await axios.get("https://api.atlassian.com/me", {
        headers: { Authorization: `Bearer ${conf.accessToken}` },
      });

      return res.json({
        connected: true,
        siteUrl: conf.siteUrl,
        connectedAt: conf.connectedAt,
      });
    } catch (error) {
      if (conf.refreshToken) {
        const refreshed = await refreshConfluenceToken(user);
        if (refreshed) {
          return res.json({
            connected: true,
            siteUrl: conf.siteUrl,
            connectedAt: conf.connectedAt,
          });
        }
      }
      return res.json({
        connected: false,
        message: "Confluence session expired. Please reconnect.",
      });
    }
  } catch (error) {
    console.error("Confluence status error:", error);
    res.status(500).json({ error: "Failed to check Confluence status" });
  }
});

// @route   GET /api/integrations/confluence/auth-url
// @desc    Get Confluence OAuth authorization URL
// @access  Private
router.get("/confluence/auth-url", auth, async (req, res) => {
  try {
    if (!CONFLUENCE_CLIENT_ID) {
      return res.status(500).json({
        error:
          "Confluence integration not configured. Please set CONFLUENCE_CLIENT_ID (Atlassian app).",
      });
    }

    const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString(
      "base64",
    );

    const authUrl =
      `https://auth.atlassian.com/authorize?` +
      `client_id=${CONFLUENCE_CLIENT_ID}&` +
      `scope=${encodeURIComponent(CONFLUENCE_SCOPES)}&` +
      `redirect_uri=${encodeURIComponent(CONFLUENCE_REDIRECT_URI)}&` +
      `state=${encodeURIComponent(state)}&` +
      `response_type=code&` +
      `prompt=consent`;

    res.json({ authUrl });
  } catch (error) {
    console.error("Auth URL error:", error);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

// @route   GET /api/integrations/confluence/callback
// @desc    Handle Confluence OAuth callback
// @access  Public (validated via state)
router.get("/confluence/callback", async (req, res) => {
  try {
    const { code, state, error: authError } = req.query;

    if (authError) {
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/integrations?error=${authError}`,
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/integrations?error=missing_params`,
      );
    }

    const stateData = JSON.parse(Buffer.from(state, "base64").toString());
    const userId = stateData.userId;

    const tokenResponse = await axios.post(
      "https://auth.atlassian.com/oauth/token",
      {
        grant_type: "authorization_code",
        client_id: CONFLUENCE_CLIENT_ID,
        client_secret: CONFLUENCE_CLIENT_SECRET,
        code,
        redirect_uri: CONFLUENCE_REDIRECT_URI,
      },
      { headers: { "Content-Type": "application/json" } },
    );

    const { access_token, refresh_token } = tokenResponse.data;

    const resourcesResponse = await axios.get(
      "https://api.atlassian.com/oauth/token/accessible-resources",
      { headers: { Authorization: `Bearer ${access_token}` } },
    );

    const resources = resourcesResponse.data;
    if (!resources || resources.length === 0) {
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/integrations?error=no_confluence_sites`,
      );
    }

    const site = resources[0];

    await User.findByIdAndUpdate(userId, {
      "integrations.confluence": {
        accessToken: access_token,
        refreshToken: refresh_token,
        cloudId: site.id,
        siteUrl: site.url,
        connectedAt: new Date(),
      },
    });

    res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/integrations?confluence=connected`,
    );
  } catch (error) {
    console.error("Confluence callback error:", error.response?.data || error);
    res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/integrations?error=callback_failed`,
    );
  }
});

// @route   POST /api/integrations/confluence/disconnect
// @desc    Disconnect Confluence integration
// @access  Private
router.post("/confluence/disconnect", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      "integrations.confluence": {
        accessToken: null,
        refreshToken: null,
        cloudId: null,
        siteUrl: null,
        connectedAt: null,
      },
    });

    res.json({
      success: true,
      message: "Confluence disconnected successfully",
    });
  } catch (error) {
    console.error("Confluence disconnect error:", error);
    res.status(500).json({ error: "Failed to disconnect Confluence" });
  }
});

// @route   GET /api/integrations/confluence/spaces
// @desc    Get Confluence spaces
// @access  Private
router.get("/confluence/spaces", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const conf = user.integrations?.confluence;

    if (!conf?.accessToken || !conf?.cloudId) {
      return res.status(401).json({ error: "Confluence not connected" });
    }

    const response = await axios.get(
      `https://api.atlassian.com/ex/confluence/${conf.cloudId}/wiki/api/v2/spaces`,
      {
        params: { limit: 50, sort: "name" },
        headers: {
          Authorization: `Bearer ${conf.accessToken}`,
          Accept: "application/json",
        },
      },
    );

    const spaces = (response.data.results || []).map((space) => ({
      id: space.id,
      key: space.key,
      name: space.name,
      type: space.type,
      status: space.status,
    }));

    res.json({ spaces });
  } catch (error) {
    console.error("Get spaces error:", error.response?.data || error);

    if (error.response?.status === 401) {
      const user = await User.findById(req.user.id);
      const refreshed = await refreshConfluenceToken(user);
      if (refreshed) {
        return router.handle(req, res);
      }
      return res.status(401).json({ error: "Confluence session expired" });
    }

    res.status(500).json({ error: "Failed to fetch spaces" });
  }
});

// @route   GET /api/integrations/confluence/spaces/:spaceId/pages
// @desc    Get recent pages in a Confluence space
// @access  Private
router.get("/confluence/spaces/:spaceId/pages", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const conf = user.integrations?.confluence;

    if (!conf?.accessToken || !conf?.cloudId) {
      return res.status(401).json({ error: "Confluence not connected" });
    }

    const response = await axios.get(
      `https://api.atlassian.com/ex/confluence/${conf.cloudId}/wiki/api/v2/spaces/${req.params.spaceId}/pages`,
      {
        params: { limit: 20, sort: "-modified-date" },
        headers: {
          Authorization: `Bearer ${conf.accessToken}`,
          Accept: "application/json",
        },
      },
    );

    const pages = (response.data.results || []).map((page) => ({
      id: page.id,
      title: page.title,
      status: page.status,
      spaceId: page.spaceId,
      _links: page._links,
    }));

    res.json({ pages });
  } catch (error) {
    console.error("Get pages error:", error.response?.data || error);
    res.status(500).json({ error: "Failed to fetch pages" });
  }
});

// @route   POST /api/integrations/confluence/pages
// @desc    Create a Confluence page from diagram node data
// @access  Private
router.post("/confluence/pages", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const conf = user.integrations?.confluence;

    if (!conf?.accessToken || !conf?.cloudId) {
      return res.status(401).json({ error: "Confluence not connected" });
    }

    const { spaceId, title, description, imageData, diagramData } = req.body;

    // Helper to safely escape HTML
    const escapeHtml = (unsafe) => {
      return (unsafe || "")
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    };

    // Build body content in storage format (HTML)
    let storageHtml = "";

    if (description) {
      storageHtml += `<p>${escapeHtml(description)}</p>`;
    }

    if (diagramData) {
      storageHtml += `<h2>Diagram Components</h2>`;
      // table
      storageHtml += `<table><tbody><tr><th>Name</th><th>Type</th><th>Description</th></tr>`;
      (diagramData.nodes || []).forEach((n) => {
        storageHtml += `<tr><td>${escapeHtml(n.label || "Untitled")}</td><td>${escapeHtml(n.type || "Unknown")}</td><td>${escapeHtml(n.description || "-")}</td></tr>`;
      });
      storageHtml += `</tbody></table>`;

      if (diagramData.edges && diagramData.edges.length > 0) {
        storageHtml += `<h2>Connections</h2><ul>`;
        diagramData.edges.forEach((e) => {
          const fromNode = diagramData.nodes.find((n) => n.id === e.from);
          const toNode = diagramData.nodes.find((n) => n.id === e.to);
          const fromName = fromNode ? fromNode.label : "Unknown";
          const toName = toNode ? toNode.label : "Unknown";
          storageHtml += `<li><strong>${escapeHtml(fromName)}</strong> connects to <strong>${escapeHtml(toName)}</strong>${e.label ? ` (${escapeHtml(e.label)})` : ""}</li>`;
        });
        storageHtml += `</ul>`;
      }
    }

    if (storageHtml === "") {
      storageHtml = `<p>Created from ArchiFlow diagram.</p>`;
    }

    // 1. Create the initial page without the image
    const createResponse = await axios.post(
      `https://api.atlassian.com/ex/confluence/${conf.cloudId}/wiki/api/v2/pages`,
      {
        spaceId,
        status: "current",
        title,
        body: {
          representation: "storage",
          value: storageHtml,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${conf.accessToken}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      },
    );

    const page = createResponse.data;

    // 2. Upload image attachment and update page body if imageData is provided
    if (imageData) {
      try {
        // Strip data:image/png;base64, prefix
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
        const imageBuffer = Buffer.from(base64Data, "base64");

        const form = new FormData();
        form.append("file", imageBuffer, {
          filename: "diagram.png",
          contentType: "image/png",
        });

        // Upload attachment using v1 API (simpler for attachments)
        await axios.post(
          `https://api.atlassian.com/ex/confluence/${conf.cloudId}/wiki/rest/api/content/${page.id}/child/attachment`,
          form,
          {
            headers: {
              ...form.getHeaders(),
              Authorization: `Bearer ${conf.accessToken}`,
              "X-Atlassian-Token": "nocheck",
            },
          },
        );

        // 3. Update the page to insert the image at the top of the body
        const attachmentHtml = `<p><ac:image ac:align="center"><ri:attachment ri:filename="diagram.png" /></ac:image></p>`;
        const updatedHtml = attachmentHtml + storageHtml;

        await axios.put(
          `https://api.atlassian.com/ex/confluence/${conf.cloudId}/wiki/api/v2/pages/${page.id}`,
          {
            id: page.id,
            status: "current",
            title,
            version: {
              number: page.version.number + 1,
              message: "Added diagram image",
            },
            body: {
              representation: "storage",
              value: updatedHtml,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${conf.accessToken}`,
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          },
        );
      } catch (attachError) {
        console.error(
          "Failed to attach image to Confluence page:",
          attachError.response?.data || attachError.message,
        );
        // Continue and return success even if attachment fails, since page was created
      }
    }

    res.json({
      success: true,
      page: {
        id: page.id,
        title: page.title,
        url: `${conf.siteUrl}/wiki${page._links?.webui || ""}`,
      },
    });
  } catch (error) {
    console.error("Create page error:", error.response?.data || error);
    res.status(500).json({
      error: "Failed to create Confluence page",
      details: error.response?.data?.errors,
    });
  }
});

// Helper: refresh Confluence token
async function refreshConfluenceToken(user) {
  try {
    const conf = user.integrations?.confluence;
    if (!conf?.refreshToken) return false;

    const response = await axios.post(
      "https://auth.atlassian.com/oauth/token",
      {
        grant_type: "refresh_token",
        client_id: CONFLUENCE_CLIENT_ID,
        client_secret: CONFLUENCE_CLIENT_SECRET,
        refresh_token: conf.refreshToken,
      },
      { headers: { "Content-Type": "application/json" } },
    );

    await User.findByIdAndUpdate(user._id, {
      "integrations.confluence.accessToken": response.data.access_token,
      "integrations.confluence.refreshToken":
        response.data.refresh_token || conf.refreshToken,
    });

    return true;
  } catch (error) {
    console.error("Token refresh error:", error.response?.data || error);
    return false;
  }
}

// GITHUB INTEGRATION

// GitHub OAuth Configuration
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI =
  process.env.GITHUB_REDIRECT_URI ||
  "http://localhost:5000/api/integrations/github/callback";

const GITHUB_SCOPES = ["repo", "user:email"].join(" ");

// @route   GET /api/integrations/github/status
// @desc    Check GitHub connection status
// @access  Private
router.get("/github/status", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const githubIntegration = user.integrations?.github;

    if (!githubIntegration?.accessToken) {
      return res.json({
        connected: false,
        message: "GitHub is not connected",
      });
    }

    try {
      const response = await axios.get("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${githubIntegration.accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      return res.json({
        connected: true,
        username: response.data.login,
        avatarUrl: response.data.avatar_url,
        connectedAt: githubIntegration.connectedAt,
      });
    } catch (error) {
      return res.json({
        connected: false,
        message: "GitHub session expired. Please reconnect.",
      });
    }
  } catch (error) {
    console.error("GitHub status error:", error);
    res.status(500).json({ error: "Failed to check GitHub status" });
  }
});

// @route   GET /api/integrations/github/auth-url
// @desc    Get GitHub OAuth authorization URL
// @access  Private
router.get("/github/auth-url", auth, async (req, res) => {
  try {
    if (!GITHUB_CLIENT_ID) {
      return res.status(500).json({
        error:
          "GitHub integration not configured. Please set GITHUB_CLIENT_ID.",
      });
    }

    const state = Buffer.from(JSON.stringify({ userId: req.user.id })).toString(
      "base64",
    );

    const authUrl =
      `https://github.com/login/oauth/authorize?` +
      `client_id=${GITHUB_CLIENT_ID}&` +
      `redirect_uri=${encodeURIComponent(GITHUB_REDIRECT_URI)}&` +
      `scope=${encodeURIComponent(GITHUB_SCOPES)}&` +
      `state=${state}`;

    res.json({ authUrl });
  } catch (error) {
    console.error("GitHub auth URL error:", error);
    res.status(500).json({ error: "Failed to generate auth URL" });
  }
});

// @route   GET /api/integrations/github/callback
// @desc    Handle GitHub OAuth callback
// @access  Public (but validated via state)
router.get("/github/callback", async (req, res) => {
  try {
    const { code, state, error: authError } = req.query;

    if (authError) {
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/integrations?error=${authError}`,
      );
    }

    if (!code || !state) {
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/integrations?error=missing_params`,
      );
    }

    const stateData = JSON.parse(Buffer.from(state, "base64").toString());
    const userId = stateData.userId;

    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
      },
      { headers: { Accept: "application/json" } },
    );

    const { access_token } = tokenResponse.data;

    if (!access_token) {
      return res.redirect(
        `${process.env.FRONTEND_URL || "http://localhost:5173"}/integrations?error=no_token`,
      );
    }

    const userResponse = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    await User.findByIdAndUpdate(userId, {
      "integrations.github": {
        accessToken: access_token,
        username: userResponse.data.login,
        connectedAt: new Date(),
      },
    });

    res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/integrations?github=connected`,
    );
  } catch (error) {
    console.error("GitHub callback error:", error.response?.data || error);
    res.redirect(
      `${process.env.FRONTEND_URL || "http://localhost:5173"}/integrations?error=callback_failed`,
    );
  }
});

// @route   POST /api/integrations/github/disconnect
// @desc    Disconnect GitHub integration
// @access  Private
router.post("/github/disconnect", auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      "integrations.github": {
        accessToken: null,
        username: null,
        connectedAt: null,
      },
    });

    res.json({ success: true, message: "GitHub disconnected successfully" });
  } catch (error) {
    console.error("GitHub disconnect error:", error);
    res.status(500).json({ error: "Failed to disconnect GitHub" });
  }
});

// @route   GET /api/integrations/github/repos
// @desc    Get user's GitHub repositories
// @access  Private
router.get("/github/repos", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const github = user.integrations?.github;

    if (!github?.accessToken) {
      return res.status(401).json({ error: "GitHub not connected" });
    }

    const response = await axios.get(
      "https://api.github.com/user/repos?sort=updated&per_page=30",
      {
        headers: {
          Authorization: `Bearer ${github.accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    const repos = response.data.map((repo) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      private: repo.private,
      url: repo.html_url,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
    }));

    res.json({ repos });
  } catch (error) {
    console.error("Get repos error:", error.response?.data || error);
    res.status(500).json({ error: "Failed to fetch repositories" });
  }
});

// @route   GET /api/integrations/github/user
// @desc    Get GitHub user info
// @access  Private
router.get("/github/user", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const github = user.integrations?.github;

    if (!github?.accessToken) {
      return res.status(401).json({ error: "GitHub not connected" });
    }

    const response = await axios.get("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${github.accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    res.json({
      login: response.data.login,
      name: response.data.name,
      avatarUrl: response.data.avatar_url,
      bio: response.data.bio,
      publicRepos: response.data.public_repos,
      profileUrl: response.data.html_url,
    });
  } catch (error) {
    console.error("Get GitHub user error:", error.response?.data || error);
    res.status(500).json({ error: "Failed to fetch user info" });
  }
});

// @route   GET /api/integrations/github/repos/:owner/:repo/branches
// @desc    Get branches of a repository
// @access  Private
router.get("/github/repos/:owner/:repo/branches", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const github = user.integrations?.github;

    if (!github?.accessToken) {
      return res.status(401).json({ error: "GitHub not connected" });
    }

    const { owner, repo } = req.params;

    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/branches?per_page=50`,
      {
        headers: {
          Authorization: `Bearer ${github.accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      },
    );

    const branches = response.data.map((b) => ({
      name: b.name,
      protected: b.protected,
    }));

    res.json({ branches });
  } catch (error) {
    console.error("Get branches error:", error.response?.data || error);
    res.status(500).json({ error: "Failed to fetch branches" });
  }
});

// @route   POST /api/integrations/github/push
// @desc    Push diagram data to a GitHub repository
// @access  Private
router.post("/github/push", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const github = user.integrations?.github;

    if (!github?.accessToken) {
      return res.status(401).json({ error: "GitHub not connected" });
    }

    const { owner, repo, branch, path, content, commitMessage } = req.body;

    if (!owner || !repo || !path || !content) {
      return res.status(400).json({
        error: "Missing required fields: owner, repo, path, content",
      });
    }

    const headers = {
      Authorization: `Bearer ${github.accessToken}`,
      Accept: "application/vnd.github.v3+json",
    };

    // Check if file already exists to get the SHA (needed for updates)
    let existingSha = null;
    try {
      const existing = await axios.get(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          headers,
          params: branch ? { ref: branch } : {},
        },
      );
      existingSha = existing.data.sha;
    } catch (err) {
      // File doesn't exist yet — that's fine, we'll create it
    }

    // Encode content to base64
    const contentBase64 = Buffer.from(content, "utf-8").toString("base64");

    // Create or update file
    const payload = {
      message: commitMessage || `Update ${path} from ArchiFlow`,
      content: contentBase64,
      branch: branch || undefined,
    };

    if (existingSha) {
      payload.sha = existingSha;
    }

    const response = await axios.put(
      `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
      payload,
      { headers },
    );

    const fileData = response.data;

    res.json({
      success: true,
      file: {
        path: fileData.content?.path,
        sha: fileData.content?.sha,
        url: fileData.content?.html_url,
        commitSha: fileData.commit?.sha,
        commitUrl: fileData.commit?.html_url,
      },
    });
  } catch (error) {
    console.error("GitHub push error:", error.response?.data || error);
    res.status(500).json({
      error: "Failed to push to GitHub",
      details: error.response?.data?.message,
    });
  }
});

module.exports = router;
