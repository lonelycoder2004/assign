const express = require("express");
const reportSchema = require("../models/report");
const router = express();

router.get("/get-reports", async (req, res) => {
  try {
    const reports = await reportSchema.find();
    res.json(reports);
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;    
