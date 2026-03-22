// backend/modules/wam/wam.routes.js

const express = require("express");
const router = express.Router();
const { validateDiagram } = require("./wam.validator");

router.post("/validate", (req, res) => {
  const diagram = req.body;
  const result = validateDiagram(diagram);
  return res.json(result);
});

module.exports = router;
