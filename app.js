const $ = (id) => document.getElementById(id);
const API = (window.QUIZ_CONFIG?.BACKEND_URL || "").replace(/\/$/, "");
let activeTest = null;

function apiReady() {
  return API && !API.includes("PASTE_YOUR_");
}

async function request(path, options={}) {
  const r = await fetch(`${API}${path}`, {
    ...options,
    headers: {"Content-Type":"application/json", ...(options.headers||{})}
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`);
  return data;
}

async function loadTests() {
  if (!apiReady()) {
    $("configWarning").classList.remove("hidden");
    $("startBtn").disabled = true;
    $("testSelect").innerHTML = "<option>Backend не подключён</option>";
    return;
  }
  try {
    const data = await request("/tests");
    $("testSelect").innerHTML = data.tests.map(t =>
      `<option value="${t.id}">${escapeHtml(t.title)} — ${t.questionCount} вопросов</option>`
    ).join("");
  } catch (e) {
    $("testSelect").innerHTML = "<option>Ошибка загрузки</option>";
    alert(e.message);
  }
}

$("startBtn").addEventListener("click", async () => {
  const studentName = $("studentName").value.trim();
  const studentId = $("studentId").value.trim();
  const testId = $("testSelect").value;
  if (studentName.length < 2 || studentId.length < 2) {
    alert("Введите ФИО и Student ID.");
    return;
  }

  $("startBtn").disabled = true;
  try {
    activeTest = await request(`/test?testId=${encodeURIComponent(testId)}`);
    activeTest.studentName = studentName;
    activeTest.studentId = studentId;
    renderQuiz();
    $("startCard").classList.add("hidden");
    $("quizCard").classList.remove("hidden");
    window.scrollTo({top:0, behavior:"smooth"});
  } catch(e) {
    alert(e.message);
  } finally {
    $("startBtn").disabled = false;
  }
});

function renderQuiz() {
  $("quizTitle").textContent = activeTest.title;
  $("progress").textContent = `${activeTest.questions.length} вопросов`;
  $("quizForm").innerHTML = activeTest.questions.map((q, i) => `
    <section class="question">
      <div class="qtext">${i+1}. ${escapeHtml(q.question)}</div>
      ${Object.entries(q.options).map(([key,val]) => `
        <label class="option">
          <input type="radio" name="q_${q.id}" value="${key}">
          <span><strong>${key}.</strong> ${escapeHtml(val)}</span>
        </label>
      `).join("")}
    </section>
  `).join("");
}

$("submitBtn").addEventListener("click", async () => {
  if (!activeTest) return;
  const answers = {};
  for (const q of activeTest.questions) {
    const picked = document.querySelector(`input[name="q_${q.id}"]:checked`);
    if (picked) answers[String(q.id)] = picked.value;
  }
  const unanswered = activeTest.questions.length - Object.keys(answers).length;
  if (unanswered && !confirm(`Осталось без ответа: ${unanswered}. Всё равно отправить?`)) return;
  if (!confirm("После отправки этот Student ID больше не сможет отправить данный тест повторно. Отправить?")) return;

  $("submitBtn").disabled = true;
  $("submitBtn").textContent = "Отправка...";
  try {
    const result = await request("/submit", {
      method:"POST",
      body:JSON.stringify({
        testId: activeTest.id,
        studentName: activeTest.studentName,
        studentId: activeTest.studentId,
        answers
      })
    });
    showResult(result);
  } catch(e) {
    alert(e.message);
    $("submitBtn").disabled = false;
    $("submitBtn").textContent = "Отправить ответы";
  }
});

function showResult(result) {
  $("quizCard").classList.add("hidden");
  $("resultCard").classList.remove("hidden");
  $("score").textContent = `${result.score}/${result.total} — ${result.percentage}%`;
  $("resultMeta").textContent = `${result.studentName} • ${result.testTitle} • ${new Date(result.submittedAt).toLocaleString()}`;
  $("review").innerHTML = result.review.map(r => `
    <div class="reviewItem">
      <strong>${escapeHtml(r.question)}</strong>
      <div class="${r.correct ? "ok":"bad"}">${r.correct ? "✓ Верно" : "✗ Неверно"}</div>
      <div>Ваш ответ: ${escapeHtml(r.selectedText || "Нет ответа")}</div>
      <div>Правильный ответ: ${escapeHtml(r.correctText)}</div>
      ${!r.correct && r.feedback ? `<div class="fine">${escapeHtml(r.feedback)}</div>` : ""}
    </div>
  `).join("");
  window.scrollTo({top:0, behavior:"smooth"});
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}

loadTests();
