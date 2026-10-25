const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");
const tests = require("./questions.json");

admin.initializeApp();
const db = admin.firestore();

function cors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Cache-Control", "no-store");
}
function clean(v, max=120) {
  return String(v ?? "").trim().slice(0,max);
}
function findTest(id) {
  return tests.find(t => t.id === id);
}
function attemptId(testId, studentId) {
  return crypto.createHash("sha256").update(`${testId}|${studentId.toLowerCase()}`).digest("hex");
}

exports.api = onRequest({ region: "us-central1" }, async (req, res) => {
  cors(res);
  if (req.method === "OPTIONS") return res.status(204).send("");

  try {
    const path = (req.path || "/").replace(/\/$/,"") || "/";

    if (req.method === "GET" && path === "/tests") {
      return res.json({
        tests: tests.map(t => ({id:t.id, title:t.title, questionCount:t.questions.length}))
      });
    }

    if (req.method === "GET" && path === "/test") {
      const test = findTest(clean(req.query.testId, 20));
      if (!test) return res.status(404).json({error:"Test not found."});
      return res.json({
        id:test.id,
        title:test.title,
        questions:test.questions.map(q => ({id:q.id, question:q.question, options:q.options}))
      });
    }

    if (req.method === "POST" && path === "/submit") {
      const testId = clean(req.body?.testId, 20);
      const studentName = clean(req.body?.studentName, 120);
      const studentId = clean(req.body?.studentId, 60);
      const answers = req.body?.answers || {};
      const test = findTest(testId);

      if (!test) return res.status(404).json({error:"Test not found."});
      if (studentName.length < 2 || studentId.length < 2) {
        return res.status(400).json({error:"Student name and ID are required."});
      }

      const id = attemptId(testId, studentId);
      const ref = db.collection("submissions").doc(id);
      const submittedAt = new Date().toISOString();

      let score = 0;
      const review = test.questions.map(q => {
        const selected = String(answers[String(q.id)] || "").toUpperCase();
        const correct = selected === q.correct;
        if (correct) score++;
        return {
          questionId:q.id,
          question:q.question,
          selected,
          selectedText:q.options[selected] || "",
          correct,
          correctAnswer:q.correct,
          correctText:q.correctText,
          feedback:q.feedback
        };
      });
      const percentage = Math.round((score / test.questions.length) * 10000) / 100;

      const record = {
        testId, testTitle:test.title, studentName, studentId,
        score, total:test.questions.length, percentage,
        answers,
        submittedAt,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      };

      await db.runTransaction(async tx => {
        const old = await tx.get(ref);
        if (old.exists) {
          const err = new Error("ALREADY_SUBMITTED");
          err.code = "ALREADY_SUBMITTED";
          throw err;
        }
        tx.create(ref, record);
      });

      return res.status(201).json({
        studentName, testTitle:test.title, score,
        total:test.questions.length, percentage, submittedAt, review
      });
    }

    return res.status(404).json({error:"Not found."});
  } catch (e) {
    console.error(e);
    if (e.code === "ALREADY_SUBMITTED" || e.message === "ALREADY_SUBMITTED") {
      return res.status(409).json({error:"This Student ID has already submitted this test. The saved result cannot be replaced from the website."});
    }
    return res.status(500).json({error:"Server error."});
  }
});
