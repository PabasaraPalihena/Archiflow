// backend/routes/diagrams.js

const express = require("express");
const router = express.Router();
const Diagram = require("../models/Diagram");
const User = require("../models/User");
const fetchuser = require("../middleware/fetchuser");

// POST: Save diagram to database (authenticated)
// Expects body: { name, description, type, tags, diagramData: { nodes, edges } }
// diagramData follows the AiDiagram shape used by the frontend canvas
router.post("/save-diagram", fetchuser, async (req, res) => {
  try {
    const { name, description, type, tags, diagramData, thumbnail } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Diagram name is required" });
    }

    if (!diagramData || !diagramData.nodes || diagramData.nodes.length === 0) {
      return res
        .status(400)
        .json({ error: "Diagram must have at least one element" });
    }

    // Check for duplicate name for this user
    const existing = await Diagram.findOne({
      user: req.user.id,
      name: name.trim(),
    });
    if (existing) {
      return res
        .status(409)
        .json({ error: "A diagram with this name already exists" });
    }

    // Create diagram with AiDiagram JSON stored directly
    const newDiagram = new Diagram({
      name: name.trim(),
      description: description || "",
      type: type || "Architecture Diagram",
      tags: tags || [],
      diagramData,
      thumbnail: thumbnail || "",
      user: req.user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const savedDiagram = await newDiagram.save();

    // Push diagram ref into the user's myDiagrams array
    await User.findByIdAndUpdate(req.user.id, {
      $push: { myDiagrams: savedDiagram._id },
    });

    res.status(201).json({
      success: true,
      message: `Diagram "${name.trim()}" saved successfully!`,
      diagram: savedDiagram,
    });
  } catch (error) {
    console.error("Error saving diagram:", error);
    res.status(500).json({
      error: "Failed to save diagram",
      details: error.message,
    });
  }
});

// GET: Retrieve authenticated user's diagrams (latest 8 by default)
router.get("/my-diagrams", fetchuser, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;

    // Populate the user's myDiagrams, sorted newest first, limited
    const user = await User.findById(req.user.id).populate({
      path: "myDiagrams",
      options: { sort: { createdAt: -1 }, limit },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      success: true,
      diagrams: user.myDiagrams || [],
    });
  } catch (error) {
    console.error("Error fetching user diagrams:", error);
    res.status(500).json({ error: "Failed to fetch diagrams" });
  }
});

// GET: Retrieve single diagram by ID (full data for loading to canvas)
router.get("/diagrams/:id", async (req, res) => {
  try {
    const diagram = await Diagram.findById(req.params.id);
    if (!diagram) {
      return res.status(404).json({ error: "Diagram not found" });
    }
    res.status(200).json({
      success: true,
      diagram: diagram,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch diagram" });
  }
});
// PUT: Update an existing diagram (authenticated)
router.put("/diagrams/:id", fetchuser, async (req, res) => {
  try {
    const diagram = await Diagram.findById(req.params.id);
    if (!diagram) {
      return res.status(404).json({ error: "Diagram not found" });
    }

    if (diagram.user.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not authorized to update this diagram" });
    }

    const { name, description, type, tags, diagramData, thumbnail } = req.body;

    // If name is changing, check for conflicts
    if (name && name.trim() !== diagram.name) {
      const conflict = await Diagram.findOne({
        user: req.user.id,
        name: name.trim(),
        _id: { $ne: diagram._id },
      });
      if (conflict) {
        return res
          .status(409)
          .json({ error: "A diagram with this name already exists" });
      }
    }

    if (name) diagram.name = name.trim();
    if (description !== undefined) diagram.description = description;
    if (type) diagram.type = type;
    if (tags) diagram.tags = tags;
    if (diagramData) diagram.diagramData = diagramData;
    if (thumbnail) diagram.thumbnail = thumbnail;
    diagram.updatedAt = new Date();

    const updated = await diagram.save();

    res.status(200).json({
      success: true,
      message: `Diagram "${updated.name}" updated successfully!`,
      diagram: updated,
    });
  } catch (error) {
    console.error("Error updating diagram:", error);
    res.status(500).json({ error: "Failed to update diagram", details: error.message });
  }
});

// DELETE: Remove a diagram by ID (authenticated)
router.delete("/diagrams/:id", fetchuser, async (req, res) => {
  try {
    const diagram = await Diagram.findById(req.params.id);
    if (!diagram) {
      return res.status(404).json({ error: "Diagram not found" });
    }

    // Remove from Diagram collection
    await Diagram.findByIdAndDelete(req.params.id);

    // Pull from user's myDiagrams array
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { myDiagrams: diagram._id },
    });

    res.status(200).json({ success: true, message: "Diagram deleted" });
  } catch (error) {
    console.error("Error deleting diagram:", error);
    res.status(500).json({ error: "Failed to delete diagram" });
  }
});

module.exports = router;
