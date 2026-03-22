const mongoose = require("mongoose");

const DiagramSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, default: "" },
  type: { type: String, default: "Architecture Diagram" },
  tags: [String],
  diagramData: { type: mongoose.Schema.Types.Mixed, required: true },
  thumbnail: { type: String, default: "" },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

DiagramSchema.index({ user: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Diagram", DiagramSchema);
