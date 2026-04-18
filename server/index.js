const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const analyzeRoutes = require("./routes/analyze");
const queryRoutes = require("./routes/query");
const graphRoutes = require("./routes/graph");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/reponav";

app.use(
  cors({
    origin: "*"
  })
);
app.use(express.json({ limit: "4mb" }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "reponav-server" });
});

app.use("/api/analyze", analyzeRoutes);
app.use("/api/query", queryRoutes);
app.use("/api/graph", graphRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`RepoNav server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
