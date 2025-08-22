require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const path = require('path');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// --- Headers Middleware (ngrok + CSP) ---
app.use((req, res, next) => {
  res.setHeader('ngrok-skip-browser-warning', 'true');
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https:; font-src 'self' data: https:;"
  );
  next();
});

// --- Middleware ---
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders: (res) => {
    res.setHeader('ngrok-skip-browser-warning', 'true');
  }
}));

// --- Database Connection ---
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI not found in .env file. Please add it.");
  process.exit(1);
}
const client = new MongoClient(uri);
let db;
let questionsCollection;
let resultsCollection;
let settingsCollection;
let attemptsCollection;

async function connectDB() {
  try {
    await client.connect();
    db = client.db("debuggingChallenge");
    questionsCollection = db.collection("questions");
    resultsCollection = db.collection("results");
    settingsCollection = db.collection("settings");
    attemptsCollection = db.collection("attempts");
    console.log("Connected to MongoDB");
    await seedDatabase();
  } catch (err) {
    console.error("Failed to connect to MongoDB", err);
    process.exit(1);
  }
}

// --- Initial Data (Seeding) ---
const INITIAL_QUESTIONS = [
  {
    description: "This function should return the sum of two numbers, but it's concatenating them as strings. Find and fix the bug.",
    buggyCode: `def add_numbers(a, b):\n  return a + b\n\nresult = add_numbers("5", "10")\nprint(result)`,
    fixedCodeSolutions: [
      `def add_numbers(a, b):\n  return int(a) + int(b)\n\nresult = add_numbers("5", "10")\nprint(result)`,
      `def add_numbers(a, b):\n  a = int(a)\n  b = int(b)\n  return a + b\n\nresult = add_numbers("5", "10")\nprint(result)`
    ],
    expectedOutput: "15",
    originalError: "TypeError: can only concatenate str (not \"int\") to str",
  },
  {
    description: "The loop should print numbers from 0 to 4, but it's not working as expected. Fix the range.",
    buggyCode: `for i in range("5"):\n  print(i)`,
    fixedCodeSolutions: [`for i in range(5):\n  print(i)`],
    expectedOutput: "0\n1\n2\n3\n4",
    originalError: "TypeError: 'str' object cannot be interpreted as an integer",
  },
  {
    description: "This code tries to access an item from a dictionary, but it's using the wrong syntax. Fix the key access.",
    buggyCode: `user = {\n  "name": "Alice",\n  "age": 30\n}\nprint(user.age)`,
    fixedCodeSolutions: [`user = {\n  "name": "Alice",\n  "age": 30\n}\nprint(user["age"])`],
    expectedOutput: "30",
    originalError: "AttributeError: 'dict' object has no attribute 'age'",
  }
];

const DEFAULT_SETTINGS = {
  _id: "global",
  timerEnabled: false,
  timerDurationMinutes: 30
};

async function seedDatabase() {
  const questionsCount = await questionsCollection.countDocuments();
  if (questionsCount === 0) {
    console.log("No questions found. Seeding database with initial data...");
    await questionsCollection.insertMany(INITIAL_QUESTIONS);
    console.log("Database seeded with questions successfully.");
  }

  const settingsCount = await settingsCollection.countDocuments({ _id: "global" });
  if (settingsCount === 0) {
    console.log("No settings found. Seeding with default settings...");
    await settingsCollection.insertOne(DEFAULT_SETTINGS);
    console.log("Database seeded with settings successfully.");
  }
}

// --- API Routes (same as before) ---
app.post('/api/attempts', async (req, res) => {
    try {
        const attemptData = { ...req.body, attemptedAt: new Date() };
        await attemptsCollection.insertOne(attemptData);
        res.status(201).json({ message: "Attempt logged" });
    } catch (err) {
        res.status(500).json({ message: "Error logging attempt", error: err });
    }
});

app.get('/api/analytics', async (req, res) => {
    try {
        // 1. General Stats
        const finishedTeamsCount = await resultsCollection.countDocuments();
        
        // Count unique teams from attempts to find started teams
        const startedTeams = await attemptsCollection.distinct("team.member1"); // A simplified way to count teams
        const startedTeamsCount = startedTeams.length;

        const avgScoreAgg = await resultsCollection.aggregate([
            { $group: { _id: null, avgScore: { $avg: "$score" } } }
        ]).toArray();
        const averageScore = avgScoreAgg.length > 0 ? avgScoreAgg[0].avgScore : 0;

        // 2. Question Stats
        const questionStats = await attemptsCollection.aggregate([
            {
                $group: {
                    _id: "$questionId",
                    totalAttempts: { $sum: 1 },
                    correctAttempts: { $sum: { $cond: ["$isCorrect", 1, 0] } }
                }
            },
            {
                $lookup: {
                    from: "questions",
                    localField: "_id",
                    foreignField: "_id",
                    as: "questionDetails"
                }
            },
            {
                $unwind: "$questionDetails"
            },
            {
                $project: {
                    _id: 0,
                    questionId: "$_id",
                    description: "$questionDetails.description",
                    totalAttempts: 1,
                    successRate: { $cond: [{ $eq: ["$totalAttempts", 0] }, 0, { $divide: ["$correctAttempts", "$totalAttempts"] }] }
                }
            },
            {
                $sort: { "questionDetails.order": 1 } // Assuming you might add an order field later
            }
        ]).toArray();

        res.json({
            startedTeamsCount,
            finishedTeamsCount,
            averageScore: averageScore.toFixed(2),
            questionStats
        });
    } catch (err) {
        console.error("Analytics error:", err);
        res.status(500).json({ message: "Error fetching analytics", error: err });
    }
});


// GET Timer Settings
app.get('/api/settings', async (req, res) => {
    try {
        const settings = await settingsCollection.findOne({ _id: "global" });
        res.json(settings || DEFAULT_SETTINGS);
    } catch (err) {
        res.status(500).json({ message: "Error fetching settings", error: err });
    }
});

// PUT (update) Timer Settings
app.put('/api/settings', async (req, res) => {
    try {
        const updateData = req.body;
        await settingsCollection.updateOne(
            { _id: "global" },
            { $set: updateData },
            { upsert: true } // Create the document if it doesn't exist
        );
        res.json({ message: "Settings updated successfully" });
    } catch (err) {
        res.status(500).json({ message: "Error updating settings", error: err });
    }
});


// GET all questions
app.get('/api/questions', async (req, res) => {
  try {
    const questions = await questionsCollection.find({}).toArray();
    res.json(questions);
  } catch (err) {
    res.status(500).json({ message: "Error fetching questions", error: err });
  }
});

// POST a new question
app.post('/api/questions', async (req, res) => {
  try {
    const newQuestion = req.body;
    const result = await questionsCollection.insertOne(newQuestion);
    const insertedDoc = await questionsCollection.findOne({ _id: result.insertedId });
    res.status(201).json(insertedDoc);
  } catch (err) {
    res.status(500).json({ message: "Error adding question", error: err });
  }
});

// PUT (update) a question
app.put('/api/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    delete updateData._id; // Do not update the _id field
    const result = await questionsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );
    if (result.matchedCount === 0) {
      return res.status(404).json({ message: "Question not found" });
    }
    res.json({ message: "Question updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error updating question", error: err });
  }
});

// DELETE a question
app.delete('/api/questions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await questionsCollection.deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) {
      return res.status(404).json({ message: "Question not found" });
    }
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ message: "Error deleting question", error: err });
  }
});

// GET all results (leaderboard)
app.get('/api/results', async (req, res) => {
  try {
    const results = await resultsCollection.find({})
      .sort({ score: -1, completedAt: 1 })
      .toArray();
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: "Error fetching results", error: err });
  }
});

// POST a new result
app.post('/api/results', async (req, res) => {
  try {
    const resultData = { ...req.body, completedAt: new Date() };
    await resultsCollection.insertOne(resultData);
    res.status(201).json(resultData);
  } catch (err) {
    res.status(500).json({ message: "Error saving result", error: err });
  }
});

// POST to check if a team has already submitted a result
app.post('/api/team/exists', async (req, res) => {
    try {
        const { member1, member2 } = req.body;
        if (!member1 || !member2) {
            return res.status(400).json({ message: "Both team member names are required." });
        }
        
        // Check for both permutations (Team A, B is the same as Team B, A)
        const teamExists = await resultsCollection.findOne({
            $or: [
                { "team.member1": member1, "team.member2": member2 },
                { "team.member1": member2, "team.member2": member1 }
            ]
        });

        res.json({ exists: !!teamExists });
    } catch (err) {
        res.status(500).json({ message: "Error checking team existence", error: err });
    }
});
  

// --- Serve Frontend ---
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Start Server ---
connectDB().then(() => {
  app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
  });
});
