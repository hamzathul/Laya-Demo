const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const pct = (v) => Math.round(Number(v || 0) * 100);
const confClass = (v) => (v >= 0.75 ? "good" : v >= 0.5 ? "warn" : "bad");
const LETTERS = "ABCDEFGHIJKL";
const MODES = { choice: ["⑂", "Choice"], score: ["▥", "Score"], yes_no: ["◐", "Yes / No"] };
const MAX_STATE = 20000;

/* ------------------------------------------------------------ examples */

const opts = (o) => Object.entries(o).map(([label, criteria]) => ({ label, criteria }));
const choice = (id, instructions, o) => ({ id, type: "choice", instructions, choices: opts(o) });
const yesno = (id, instructions, yes = "", no = "") => ({ id, type: "yes_no", instructions, yes, no });
const score = (id, instructions, levels) => ({ id, type: "score", instructions, levels });

const PRESETS = [
  {
    key: "support",
    label: "Support routing",
    state: () => EXAMPLES.support[0].text,
    questions: () => [
      choice("team", "Which IT team should handle this ticket?", {
        network: "Wi-Fi, VPN, internet, office network or remote connection problems",
        hardware: "laptop, monitor, printer, phone, dock or other physical device fault",
        software: "an application crashing, not installing, or needing a licence",
        access: "new joiner setup, permissions, shared folders, MFA or password reset",
        security: "phishing email, suspicious login, malware, or a lost or stolen device",
      }),
      choice("impact", "How many people are affected?", {
        single_user: "only the person who raised the ticket",
        team: "a team, a floor or one office",
        company_wide: "everyone, or a system the whole company relies on",
      }),
      yesno("security_risk", "Could company data or accounts be at risk?",
        "a click on a suspicious link, a lost device, unknown logins or leaked credentials",
        "an ordinary fault or request with no sign of compromise"),
      score("urgency", "How urgent is this?", [
        "a request that can wait several days",
        "an inconvenience with a workaround",
        "someone cannot do their job until it is fixed",
        "a security incident or many people blocked right now",
      ]),
    ],
  },
  {
    key: "email",
    label: "Email triage",
    state: () => EXAMPLES.email[0].text,
    questions: () => [
      choice("category", "Which category best describes this tenant email?", {
        emergency_repair: "water leak, flooding, no heating, gas smell, power cut or a broken lock",
        routine_maintenance: "a non-urgent repair such as a dripping tap, faulty appliance or broken blind",
        neighbour_complaint: "noise, smells, parking, rubbish or behaviour of other residents",
        lease_and_moving: "lease renewal, notice to leave, move-in or move-out, keys or inspections",
        general_enquiry: "parking permits, deliveries, building rules or other questions",
      }),
      yesno("needs_visit", "Does someone need to visit the property?",
        "a contractor, caretaker or property manager must attend in person",
        "it can be handled by email or phone"),
      score("urgency", "How quickly does this need action?", [
        "within a couple of weeks",
        "within a few days",
        "within 24 hours",
        "immediately: risk to safety or serious damage to the building",
      ]),
    ],
  },
  {
    key: "meeting",
    label: "Meeting notes",
    state: () => EXAMPLES.meeting[0].text,
    questions: () => [
      yesno("has_action", "Does someone commit to do work after this meeting?"),
      yesno("has_decision", "Did the group make a decision?"),
      yesno("has_deadline", "Is a date or deadline mentioned for any task?"),
      choice("meeting_type", "What kind of meeting was this?", {
        planning: "planning a launch, project or schedule",
        status: "progress update on work already under way",
        kickoff: "starting a new project or client engagement",
        review: "reviewing results, incidents or decisions made earlier",
      }),
    ],
  },
  {
    key: "contract",
    label: "Contract check",
    state: () => EXAMPLES.contract[1].text,
    questions: () => [
      choice("type", "What kind of contract is this?", {
        nda: "non-disclosure or confidentiality agreement",
        msa: "master services or professional services agreement",
        sow: "statement of work",
        lease: "property or equipment lease",
        employment: "employment or contractor agreement",
        other: "anything else",
      }),
      yesno("limits_liability", "Does the contract limit either party's liability?"),
      yesno("personal_data", "Does the contract cover processing of personal data?"),
      yesno("terminate_convenience", "Can either party terminate for convenience?"),
    ],
  },
  {
    key: "invoice",
    label: "Invoice photo (vision)",
    src: "/samples/invoice-overdue.png",
    questions: () => [
      choice("doc_type", "Which title is printed on this document?", {
        "Invoice": "Invoice",
        "Freight Invoice": "Freight Invoice",
        "Credit Note": "Credit Note",
        "Debit Note": "Debit Note",
        "Payment Receipt": "Payment Receipt",
        "Purchase Order": "Purchase Order",
        "Account Statement": "Account Statement",
        "Other": "no title, or a different title",
      }),
      yesno("overdue", "Is this document marked OVERDUE?"),
      yesno("paid", "Is this document marked PAID?"),
    ],
  },
];

/* ------------------------------------------------------------ app state */

const S = { preset: null, Q: [], last: null, outTab: "result", busy: false, ready: false };

function blankQuestion(type = "yes_no") {
  const n = S.Q.length + 1;
  const base = { id: `q${n}`, type, instructions: "" };
  if (type === "choice") return { ...base, choices: [{ label: "", criteria: "" }, { label: "", criteria: "" }] };
  if (type === "score") return { ...base, levels: ["", ""] };
  return { ...base, yes: "", no: "" };
}

/* ------------------------------------------------------------ question editor */

function questionHTML(q, i) {
  const modes = Object.entries(MODES)
    .map(([k, [icon, name]]) => `<button class="${k} ${q.type === k ? `on ${k}` : ""}" data-mode="${k}"><span>${icon}</span>${name}</button>`)
    .join("");
  let body = "";
  if (q.type === "choice") {
    body = `<div class="sub-label"><span>Options</span><span>${q.choices.length} of 12</span></div>` +
      q.choices.map((c, j) => `<div class="row">
        <span class="badge">${LETTERS[j]}</span>
        <input class="o-label" data-f="label" data-j="${j}" value="${esc(c.label)}" placeholder="option name" spellcheck="false">
        <input data-f="criteria" data-j="${j}" value="${esc(c.criteria)}" placeholder="what this option means" spellcheck="false">
        <button class="x" data-del-opt="${j}" title="Remove">×</button></div>`).join("") +
      `<button class="add-opt" data-add-opt>+ Add option</button>`;
  } else if (q.type === "score") {
    body = `<div class="sub-label"><span>Scale — lowest first</span><span>${q.levels.length} levels</span></div>` +
      q.levels.map((l, j) => `<div class="row lvl">
        <span class="badge">${j}</span>
        <input data-f="level" data-j="${j}" value="${esc(l)}" placeholder="what level ${j} means" spellcheck="false">
        <button class="x" data-del-opt="${j}" title="Remove">×</button></div>`).join("") +
      `<button class="add-opt" data-add-opt>+ Add level</button>`;
  } else {
    body = `<p class="yn-help">Laya returns the probability that the answer is <b>yes</b>. The two hints below are optional.</p>
      <div class="yn-grid">
        <div><label>“yes” means</label><input data-f="yes" value="${esc(q.yes)}" placeholder="optional" spellcheck="false"></div>
        <div><label>“no” means</label><input data-f="no" value="${esc(q.no)}" placeholder="optional" spellcheck="false"></div>
      </div>`;
  }
  return `<div class="q" data-i="${i}">
    <div class="q-top"><span class="q-num">Q${i + 1}</span>
      <input class="q-id" data-f="id" value="${esc(q.id)}" title="Key for this question in the API" spellcheck="false">
      <button class="q-del" data-del-q title="Remove question">×</button></div>
    <div class="modes">${modes}</div>
    <input class="q-text" data-f="instructions" value="${esc(q.instructions)}" placeholder="The question Laya answers, e.g. “Is the customer angry?”">
    ${body}
  </div>`;
}

function renderQuestions() {
  $("#questions").innerHTML = S.Q.map(questionHTML).join("");
  $("#qcount").textContent = `${S.Q.length} of 8`;
  $("#add-q").disabled = S.Q.length >= 8;
}

$("#questions").addEventListener("input", (e) => {
  const f = e.target.dataset.f;
  if (!f) return;
  const q = S.Q[Number(e.target.closest(".q").dataset.i)];
  const j = Number(e.target.dataset.j);
  if (f === "id" || f === "instructions" || f === "yes" || f === "no") q[f] = e.target.value;
  else if (f === "label") q.choices[j].label = e.target.value;
  else if (f === "criteria") q.choices[j].criteria = e.target.value;
  else if (f === "level") q.levels[j] = e.target.value;
});

$("#questions").addEventListener("click", (e) => {
  const card = e.target.closest(".q");
  if (!card) return;
  const q = S.Q[Number(card.dataset.i)];
  const mode = e.target.closest("[data-mode]");
  if (mode) {
    if (q.type === mode.dataset.mode) return;
    const fresh = blankQuestion(mode.dataset.mode);
    S.Q[Number(card.dataset.i)] = { ...fresh, id: q.id, instructions: q.instructions };
    return renderQuestions();
  }
  if (e.target.closest("[data-add-opt]")) {
    if (q.type === "choice" && q.choices.length < 12) q.choices.push({ label: "", criteria: "" });
    if (q.type === "score" && q.levels.length < 10) q.levels.push("");
    return renderQuestions();
  }
  const del = e.target.closest("[data-del-opt]");
  if (del) {
    const j = Number(del.dataset.delOpt);
    if (q.type === "choice" && q.choices.length > 2) q.choices.splice(j, 1);
    if (q.type === "score" && q.levels.length > 2) q.levels.splice(j, 1);
    return renderQuestions();
  }
  if (e.target.closest("[data-del-q]")) {
    if (S.Q.length <= 1) return;
    S.Q.splice(Number(card.dataset.i), 1);
    renderQuestions();
  }
});

$("#add-q").addEventListener("click", () => {
  if (S.Q.length >= 8) return;
  S.Q.push(blankQuestion("yes_no"));
  renderQuestions();
  const last = $$("#questions .q").pop();
  $(".q-text", last).focus();
});

/* ------------------------------------------------------------ state + examples */

function updateCounter() {
  const n = $("#state").value.length;
  $("#counter").textContent = `${n.toLocaleString()} / ${MAX_STATE.toLocaleString()}`;
}
$("#state").setAttribute("maxlength", MAX_STATE);
$("#state").addEventListener("input", () => { updateCounter(); });

function buildChips() {
  $("#chips").innerHTML = PRESETS.map((p) => `<button class="chip" data-key="${p.key}">${esc(p.label)}</button>`).join("");
}

async function applyPreset(key, runAfter = true) {
  const p = PRESETS.find((x) => x.key === key);
  if (!p) return;
  S.preset = key;
  setImage(null);
  $$("#chips .chip").forEach((c) => c.classList.toggle("on", c.dataset.key === key));
  S.Q = p.questions();
  renderQuestions();
  S.last = null;
  showResult();
  if (p.src) {
    $("#state").value = "";
    updateCounter();
    try {
      const blob = await (await fetch(p.src)).blob();
      setImage(new File([blob], p.src.split("/").pop(), { type: blob.type || "image/png" }));
    } catch (err) {
      return showError(err.message);
    }
    if (runAfter) run();
  } else {
    $("#state").value = p.state();
    updateCounter();
    if (runAfter) run();
  }
}

$("#chips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (chip) applyPreset(chip.dataset.key, false);
});
$("#reset").addEventListener("click", () => S.preset && applyPreset(S.preset, false));
$("#clear").addEventListener("click", () => {
  setImage(null);
  $("#state").value = "";
  updateCounter();
  S.last = null;
  showResult();
});

/* ------------------------------------------------------------ image as state (vision) */

function setImage(file) {
  if (S.imageUrl) URL.revokeObjectURL(S.imageUrl);
  S.image = file;
  S.imageUrl = file ? URL.createObjectURL(file) : null;
  $("#img-state").hidden = !file;
  if (file) $("#img-preview").src = S.imageUrl;
  $("#state").hidden = !!file;
  $("#counter").hidden = !!file;
  $("label[for=state]").textContent = file ? "State (image)" : "State";
}

$("#img-btn").addEventListener("click", () => $("#img-file").click());
$("#img-remove").addEventListener("click", () => setImage(null));
$("#img-file").addEventListener("change", () => {
  const f = $("#img-file").files[0];
  if (f) setImage(f);
  $("#img-file").value = "";
});

/* ------------------------------------------------------------ request */

function cleanQuestion(q, i) {
  const out = { id: (q.id || `q${i + 1}`).trim() || `q${i + 1}`, type: q.type, instructions: q.instructions.trim() };
  if (q.type === "choice") out.choices = q.choices.filter((c) => c.label.trim()).map((c) => ({ label: c.label.trim(), criteria: c.criteria.trim() }));
  if (q.type === "score") out.levels = q.levels.map((l) => l.trim()).filter(Boolean);
  if (q.type === "yes_no") {
    if (q.yes.trim()) out.yes = q.yes.trim();
    if (q.no.trim()) out.no = q.no.trim();
  }
  return out;
}

const requestBody = () => ({ text: $("#state").value.trim(), questions: S.Q.map(cleanQuestion) });

function hl(text) {
  return esc(text).replace(
    /(&quot;(?:\\.|[^&\\]|&(?!quot;))*?&quot;)(\s*:)?|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?\b)/g,
    (m, str, colon, lit, num) => {
      if (str) return colon ? `<span class="k">${str}</span>${colon}` : `<span class="s">${str}</span>`;
      return `<span class="nb">${lit || num}</span>`;
    }
  );
}

/* ------------------------------------------------------------ output */

function bars(probs, winner, labelOf = (k) => k) {
  const entries = Object.entries(probs || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return "";
  return `<div class="bars">${entries.map(([k, v]) => `<div class="bar ${String(k) === String(winner) ? "win" : ""}">
      <span class="lbl" title="${esc(labelOf(k))}">${esc(labelOf(k))}</span>
      <span class="track"><i style="width:${pct(v)}%"></i></span><span class="pct">${pct(v)}%</span></div>`).join("")}</div>`;
}

/* ------------------------------------------------------------ what Laya receives and returns */

function toLaya(q) {
  if (q.type === "choice") return { type: "choice", instructions: q.instructions, criteria: Object.fromEntries(q.choices.map((c) => [c.label, c.criteria || c.label])) };
  if (q.type === "score") return { type: "score", instructions: q.instructions, criteria: q.levels };
  const o = { type: "noul", instructions: q.instructions };
  const c = {};
  if (q.yes) c.true = q.yes;
  if (q.no) c.false = q.no;
  if (Object.keys(c).length) o.criteria = c;
  return o;
}

function snapshotInput() {
  const body = requestBody();
  const qs = {};
  body.questions.forEach((q) => (qs[q.id] = toLaya(q)));
  const image = S.image ? S.image.name || "image" : null;
  const text = body.text.length > 500 ? body.text.slice(0, 500) + " …" : body.text;
  return { image, state: image ? `<image: ${image}>` : text, qs };
}

const pre = (obj) => `<pre class="json">${hl(typeof obj === "string" ? obj : JSON.stringify(obj, null, 2))}</pre>`;

function ioView() {
  const inp = S.last && S.lastIn && !S.edited ? S.lastIn : snapshotInput();
  const call = inp.image ? "agent.predict(image=img, questions=questions)   # vision: the image is the state" : "agent.predict(state, questions)   # text";
  const raw = S.last ? pre(S.last.raw) : `<div class="muted">Press <b>Run Laya</b> to see Laya's output.</div>`;
  return `<div class="io-view">
    <h3>Input to Laya</h3>
    <p class="io-note">The <b>state</b> is a text, or an image in vision mode, plus a dictionary of typed <b>questions</b>.${S.last && !S.edited ? " This is exactly what the last run sent." : " It updates as you edit the form."}</p>
    <div class="sub-label">state</div>
    <pre class="json">${esc(inp.state)}</pre>
    <div class="sub-label">questions</div>
    ${pre(inp.qs)}
    <p class="io-note"><code>"noul"</code> is Laya's name for a yes/no question. A yes/no hint becomes <code>criteria.true</code> / <code>criteria.false</code>.</p>
    <pre class="json">${esc(call)}</pre>
    <h3>Output from Laya</h3>
    <p class="io-note">The <code>raw</code> field of the response: Laya's own output, untouched.</p>
    ${raw}
  </div>`;
}

function ioDetails(a) {
  const q = S.lastIn?.qs?.[a.id];
  const out = S.last?.raw?.[a.id];
  if (!q || !out) return "";
  return `<details class="io"><summary>Show Laya input / output</summary>
    <div class="sub-label">input · questions["${esc(a.id)}"]</div>${pre(q)}
    <div class="sub-label">output · raw["${esc(a.id)}"]</div>${pre(out)}</details>`;
}

function answerCard(a) {
  const [icon, name] = MODES[a.type];
  const review = a.abstain || a.route === "review" ? '<div class="review">⚠ Laya flags this one for review</div>' : "";
  let main = "";
  if (a.type === "yes_no") {
    main = `<div><span class="ans-val ${a.answer}">${a.answer.toUpperCase()}</span><span class="ans-sub">p_yes = ${a.p_yes.toFixed(3)}</span></div>
      <div class="yn-track"><i style="width:${pct(a.p_yes)}%"></i></div>
      <div class="scale-lab"><span>0 · no</span><span>1 · yes</span></div>`;
  } else if (a.type === "score") {
    const top = Object.entries(a.probs).reduce((m, e) => (e[1] > m[1] ? e : m))[0];
    main = `<div><span class="ans-val">${a.answer.toFixed(2)}</span><span class="ans-sub">weighted average on a ${a.scale.min}–${a.scale.max} scale · most likely level ${esc(top)}</span></div>
      ${bars(a.probs, top, (k) => `${k} · ${a.levels[k] ?? ""}`)}`;
  } else {
    main = `<div><span class="ans-val">${esc(a.answer)}</span><span class="ans-sub">1 of ${Object.keys(a.probs).length} options</span></div>${bars(a.probs, a.answer)}`;
  }
  return `<div class="ans">
    <div class="ans-top"><span class="tag ${a.type}">${icon} ${name}</span><span class="ans-id">${esc(a.id)}</span>
      <span class="conf ${confClass(a.confidence)}" title="How sure Laya is about this answer (0–1)">confidence ${a.confidence.toFixed(2)}</span></div>
    <div class="ans-q">${esc(a.question)}</div>${main}${review}${ioDetails(a)}</div>`;
}

function showResult() {
  const box = $("#result"), json = $("#json"), laya = $("#laya");
  if (!S.last) {
    box.innerHTML = `<div class="empty"><h3>A little context. A clear decision.</h3>Pick an example or write your own state and questions, then press <b>Run Laya</b>.</div>`;
    json.innerHTML = hl("// Press Run Laya to see the response.");
  } else {
    box.innerHTML = `<div class="meta">${S.last.answers.length} question${S.last.answers.length > 1 ? "s" : ""} answered in one pass · ${S.last.ms} ms</div>` + S.last.answers.map(answerCard).join("");
    json.innerHTML = hl(JSON.stringify(S.last, null, 2));
  }
  laya.innerHTML = S.outTab === "laya" ? ioView() : "";
  laya.hidden = S.outTab !== "laya";
  box.hidden = S.outTab !== "result";
  json.hidden = S.outTab !== "json";
  $$("#out-tabs button").forEach((b) => b.classList.toggle("on", b.dataset.out === S.outTab));
}

function showError(message) {
  S.outTab = "result";
  showResult();
  $("#result").innerHTML = `<div class="error">${esc(message)}</div>`;
}

document.addEventListener("input", () => {
  S.edited = true;
  if (S.outTab === "laya" && !S.busy) showResult();
});

$("#out-tabs").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  S.outTab = b.dataset.out;
  showResult();
});

/* ------------------------------------------------------------ run */

function validate(body) {
  if (!S.image && body.text.length < 10) return "Write or paste some state text first (at least 10 characters).";
  for (const [i, q] of body.questions.entries()) {
    if (q.instructions.length < 3) return `Q${i + 1} needs a question sentence.`;
    if (q.type === "choice" && q.choices.length < 2) return `Q${i + 1} needs at least two options.`;
    if (q.type === "score" && q.levels.length < 2) return `Q${i + 1} needs at least two scale levels.`;
  }
  return null;
}

function setBusy(on) {
  S.busy = on;
  $("#run").disabled = on || !S.ready;
  $("#run").innerHTML = on ? "Running…" : "Run Laya <span>↗</span>";
}

async function run() {
  if (S.busy) return;
  const body = requestBody();
  const problem = validate(body);
  if (problem) return showError(problem);
  S.lastIn = snapshotInput();
  S.edited = false;
  setBusy(true);
  S.outTab = "result";
  $("#result").hidden = false;
  $("#json").hidden = true;
  $("#result").innerHTML = '<div class="loading">Laya is deciding…</div>';
  try {
    let res;
    if (S.image) {
      $("#result").innerHTML = '<div class="loading">Laya is looking at the image… (the first run loads the vision model and can take a minute)</div>';
      const fd = new FormData();
      fd.append("file", S.image, S.image.name || "image.png");
      fd.append("questions", JSON.stringify(body.questions));
      res = await fetch("/api/decide-image", { method: "POST", body: fd });
    } else {
      res = await fetch("/api/decide", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(typeof data.detail === "string" ? data.detail : `Request failed (${res.status})`);
    S.last = data;
    showResult();
  } catch (err) {
    showError(err.message);
  } finally {
    setBusy(false);
  }
}

$("#run").addEventListener("click", run);
document.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); run(); }
});

/* ------------------------------------------------------------ health */

function lane(id, info, readyText) {
  const el = $(id);
  el.classList.remove("ready", "error");
  const em = $("em", el);
  el.title = info?.error || "";
  if (info?.state === "ready") { el.classList.add("ready"); em.textContent = readyText; }
  else if (info?.state === "error") { el.classList.add("error"); em.textContent = "unavailable"; }
  else em.textContent = "loading…";
}

async function pollHealth() {
  let delay = 3000;
  try {
    const h = await (await fetch("/api/health")).json();
    lane("#st-model", h.text, `${h.text.model} · ready`);
    const v = $("#st-vision"), vs = h.vision.state;
    v.classList.toggle("ready", vs === "ready");
    v.classList.toggle("error", vs === "error");
    $("em", v).textContent = vs === "ready" ? "ready" : vs === "error" ? "unavailable" : vs === "loading" ? "loading…" : "loads on first image";
    v.title = h.vision.error || "";
    S.ready = h.text.state === "ready";
    setBusy(S.busy);
    delay = h.text.state === "loading" || h.vision.state === "loading" ? 2000 : 6000;
  } catch { /* retry */ }
  setTimeout(pollHealth, delay);
}

/* ------------------------------------------------------------ init */

buildChips();
pollHealth();
applyPreset("support", false);
