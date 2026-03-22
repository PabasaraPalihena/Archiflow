const express = require("express");
const cors = require("cors");
const aiRoutes = require("./models/ai/ai.routes.js");
const wamRoutes = require("./models/wam/wam.routes.js");
const costEstimateRoutes = require("./routes/costEstimate");
const diagramRoutes = require("./routes/diagrams");
const authRoutes = require("./routes/auth");
const { initPriceScheduler } = require("./jobs/priceScheduler");

require("dotenv").config();
require("./common/database")();

const app = express();

//request allow any domain
app.use(cors({ origin: "*" }));

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb" }));

//listen for request
const PORT = process.env.PORT || 5001;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initPriceScheduler();
  });
}

//Mount Routes
app.use("/api/auth", authRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/wam", wamRoutes);
app.use("/api/cost", costEstimateRoutes);
app.use("/api", diagramRoutes);
app.use("/api/integrations", require("./routes/integrations"));
app.use("/api/subscription", require("./routes/subscription"));

module.exports = app;
