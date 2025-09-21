const express = require("express");
const multer = require("multer");
const path = require("path");
const reportSchema = require("../models/report");
const userSchema = require("../models/user");
const router = express();
const { GoogleGenAI } = require("@google/genai");
const fs = require("fs");
const dotenv = require("dotenv");
dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY, // or hardcode for testing
});

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Make sure this folder exists
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

router.get("/", async (req, res) => {
  res.send("User Route is working... 🚀");
});

router.post("/google-auth", async (req, res) => {
  try {
    const { email, name, googleId } = req.body;
    console.log("Google Auth Request Body:", req.body);
    if (!email || !googleId) {
      return res.status(400).json({ error: "Missing email or googleId" });
    }
    let user = await userSchema.findOne({ email });
    if (user) {
      // User exists, return existing user
      return res
        .status(200)
        .json({ user, message: "User exists, login successful" });
    } else {
      // User does not exist, create new
      user = new userSchema({ email, name, googleId });
      await user.save();
      return res
        .status(201)
        .json({ user, message: "User created and login successful" });
    }
  } catch (error) {
    console.error("Google Auth Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Report route: create a new report with image upload
router.post("/report", upload.single("image"), async (req, res) => {
  try {
    const { userId, description } = req.body;
    console.log("Report Request Body:", req.body);
    if (!userId || !description) {
      return res.status(400).json({ error: "Missing userId or description" });
    }
    let imageUrl = null;
    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`;
    }
    const report = new reportSchema({
      userId,
      description,
      imageUrl,
    });
    await report.save();
    return res
      .status(201)
      .json({ report, message: "Report created successfully" });
  } catch (error) {
    console.error("Report Error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/verify-safety", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "Image file is required" });
    }

    const imagePath = req.file.path;
    const imageBase64 = fs.readFileSync(imagePath, { encoding: "base64" });

    // Compose prompt
    const prompt = `
You are a safety compliance inspector.
I will provide you an image of a person in a laboratory.
Your task is to check if the person is wearing the following personal protective equipment (PPE):

Helmet (hard hat or protective headgear)
Green safety coat for visibility
Safety boots (closed-toe protective footwear)

For each item, answer yes or no

Finally, give an overall compliance status just safe or unsafe:
"Safe" (all PPE present)
"Unsafe" (if any PPE missing)

give the final response in a short format as below:
Helmet: Yes/No
Green safety coat: Yes/No
Safety boots: Yes/No  
Final Compliance: Safe/Unsafe

Image: [See attached]
`;

    // Send to Gemini
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: req.file.mimetype, data: imageBase64 } },
          ],
        },
      ],
    });

    fs.unlink(imagePath, (err) => {
      if (err) {
        console.error("Error deleting image:", err);
      } else {
        console.log("Image deleted:", imagePath);
      }
    });


    // Try these to access the result:
    const resultText =
      response.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No result from Gemini";

    // Return AI result
    res.json({ result: resultText || "No result from Gemini" });
  } catch (error) {
    console.error("Verify Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
