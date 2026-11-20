const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  tab: "email",
  health: null,
  busy: {},
  visionFile: null,
  visionUrl: null,
  lastVisionText: "",
  presets: null,
};

const PRETTY = {
  complaint: "Complaint",
  sales_enquiry: "Sales enquiry",
  urgent_request: "Urgent request",
  general_enquiry: "General enquiry",
  refund_or_compensation: "Refund / compensation",
  report_problem: "Report a problem",
  request_information: "Request information",
  request_quote: "Request a quote",
  schedule_meeting: "Schedule a meeting",
  cancel_or_leave: "Cancel / leave",
  other: "Other",
  apologize_and_offer_fix: "Apologize + offer a fix",
  acknowledge_and_investigate: "Acknowledge + investigate",
  send_pricing: "Send pricing",
  provide_information: "Provide information",
  schedule_call: "Schedule a call",
  escalate_to_human: "Escalate to a human",
  angry: "Angry",
  frustrated: "Frustrated",
  neutral: "Neutral",
  satisfied: "Satisfied",
  billing: "Billing",
  delivery: "Delivery",
  product_defect: "Product defect",
  account_access: "Account access",
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
  billing_fix: "Billing fix",
  delivery_trace: "Delivery trace",
  replacement: "Replacement",
  account_recovery: "Account recovery",
  escalate: "Escalate",
  general: "General",
  nda: "NDA",
  msa: "MSA",
  sow: "SOW",
  lease: "Lease",
  employment: "Employment",
  liability: "Liability",
  termination: "Termination",
  term: "Term / renewal",
  payment: "Payment",
  assignment: "Assignment",
  governing_law: "Governing law",
  confidentiality: "Confidentiality",
  data_protection: "Data protection",
  exclusivity: "Exclusivity",
  human: "Human reply",
  automated: "Automated reply",
  invoice: "Invoice",
  freight_invoice: "Freight invoice",
  receipt: "Receipt",
  purchase_order: "Purchase order",
  credit_note: "Credit note",
  debit_note: "Debit note",
  statement: "Statement",
  under_100: "Under $100",
  "100_1k": "$100 – $1k",
  "1k_10k": "$1k – $10k",
  over_10k: "Over $10k",
  paid: "Paid",
  due_30: "Due within 30 days",
  overdue: "Overdue",
  open: "Open — not paid yet",
  credit: "Credit — reduces balance",
  summary: "Summary only",
  unclear: "Unclear",
};

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));

const pct = (value) => Math.round(Number(value || 0) * 100);

const pretty = (value) => {
  if (!value) return "—";
  return PRETTY[value] || String(value).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
};

const confClass = (value) => (value >= 0.75 ? "good" : value >= 0.5 ? "warn" : "bad");

function head(ms, lane, kind) {
  const button = kind
    ? `<button class="ghost small" data-custom="${kind}">Customize questions</button>`
    : "";
  return `<div class="result-head"><span class="badge ${lane === "ocr" ? "ocr" : ""}">${lane} lane · ${ms} ms</span>${button}</div>`;
}

function loadingCard(message) {
  return `<div class="loading">${esc(message)}</div>`;
}

function errorCard(message) {
  return `<div class="error">${esc(message)}</div>`;
}

function bars(probs, chosen, limit = 4) {
  const entries = Object.entries(probs || {}).sort((a, b) => b[1] - a[1]).slice(0, limit);
  if (!entries.length) return "";
  return `<div class="probs">${entries
    .map(
      ([key, value]) => `
      <div class="prob-row ${key === chosen ? "chosen" : ""}">
        <div class="prob-top"><span>${esc(pretty(key))}</span><span>${pct(value)}%</span></div>
        <div class="bar"><i style="width:${pct(value)}%"></i></div>
      </div>`
    )
    .join("")}</div>`;
}

function cardChoice(title, answer, limit = 4) {
  if (!answer) return "";
  const review = answer.abstain || answer.route === "review";
  return `<div class="card">
    <h4>${esc(title)}</h4>
    <div class="value-row">
      <span class="value">${esc(pretty(answer.label))}</span>
      <span class="conf ${confClass(answer.confidence)}">${pct(answer.confidence)}%</span>
    </div>
    ${review ? '<span class="chip warn" style="margin-top:6px">review</span>' : ""}
    ${bars(answer.probs, answer.label, limit)}
  </div>`;
}

function renderEmail(data) {
  return `${head(data.ms, "text", "email")}
    <div class="grid2">
      ${cardChoice("Category", data.category)}
      ${cardChoice("Sender intent", data.intent)}
      ${cardChoice("Reply handling", data.needs_human)}
    </div>`;
}

function renderSupport(data) {
  return `${head(data.ms, "text", "support")}
    <div class="grid2">
      ${cardChoice("Sentiment", data.sentiment)}
      ${cardChoice("Team", data.category)}
      ${cardChoice("Priority", data.priority)}
      ${cardChoice("Reply template", data.reply_template)}
    </div>`;
}

function renderMeeting(data) {
  const muted = '<div class="muted">None found.</div>';

  const actions = data.actions.length
    ? data.actions
        .map(
          (item) => `<div class="item">
        <p>${esc(item.text)}</p>
        <div class="chips" style="margin-top:6px">
          <span class="chip good">${esc(item.owner)}${item.owner_confidence == null ? "" : ` · ${pct(item.owner_confidence)}%`}</span>
          ${item.deadline ? `<span class="chip">${esc(item.deadline)}</span>` : ""}
        </div>
      </div>`
        )
        .join("")
    : muted;

  const decisions = data.decisions.length
    ? data.decisions
        .map(
          (item) => `<div class="item">
        <p>${esc(item.text)}</p>
        <div class="bar"><i style="width:${pct(item.prob)}%"></i></div>
      </div>`
        )
        .join("")
    : muted;

  return `${head(data.ms, "text", "meeting")}
    <div class="result-head"><span class="muted">scanned ${data.scanned.lines} lines · ${data.scanned.names} names in one batched pass</span></div>
    <div class="grid2">
      <div class="card"><h4>Action items</h4>${actions}</div>
      <div class="card"><h4>Decisions</h4>${decisions}</div>
    </div>`;
}

function renderContract(data) {
  const sections = data.sections
    .map(
      (section) => `<div class="clause">
        <div class="prob-top">
          <span>${esc(section.heading)} <span class="chip">${esc(pretty(section.topic))}</span></span>
          <span>${pct(section.confidence)}%</span>
        </div>
        <div class="bar"><i style="width:${pct(section.confidence)}%"></i></div>
        <div class="muted" style="margin-top:4px">${esc(section.owner)} review</div>
      </div>`
    )
    .join("");

  const counts = Object.entries(data.counts)
    .map(([owner, count]) => `<span class="chip">${esc(owner)} · ${count}</span>`)
    .join("");

  return `${head(data.ms, "text", "contract")}
    <div class="grid2">
      ${cardChoice("Contract type", data.type)}
      <div class="card"><h4>Routed to</h4><div class="chips">${counts}</div></div>
    </div>
    <div class="card wide"><h4>Clauses</h4>${sections}</div>`;
}

function renderVision(data) {
  const pos = data.po_numbers.length
    ? `<div class="chips">${data.po_numbers
        .map((po) => `<span class="chip">${esc(po)}</span>`)
        .join("")}</div>`
    : '<div class="muted">No PO number found in the text.</div>';

  return `${head(data.ms, "ocr", "vision")}
    <div class="result-head"><span class="muted">OCR ${data.ocr_ms} ms · decision ${data.ms - data.ocr_ms} ms</span></div>
    <div class="grid2">
      ${cardChoice("Document type", data.doc_type)}
      <div class="card">
        <h4>Payment mark <span class="chip">from text</span></h4>
        <div class="value-row"><span class="value">${esc(pretty(data.payment_mark))}</span></div>
        <div class="muted" style="margin-top:6px">Read from the OCR text, not decided by the model.</div>
      </div>
      <div class="card">
        <h4>Purchase orders <span class="chip">from text</span></h4>
        ${pos}
      </div>
    </div>
    <div class="card wide"><h4>Text read by OCR</h4><p class="ocr-text">${esc(data.text)}</p></div>`;
}

function renderCustom(data) {
  return `${head(data.ms, "text")}
    <div class="grid2">
      ${data.answers.map((answer) => cardChoice(answer.question, answer, 12)).join("")}
    </div>`;
}

const RENDER = {
  email: renderEmail,
  support: renderSupport,
  meeting: renderMeeting,
  contract: renderContract,
  vision: renderVision,
  custom: renderCustom,
};

/* ---------- examples ---------- */

function buildExamples() {
  $$(".examples").forEach((box) => {
    const kind = box.dataset.kind;
    if (!kind) return;
    const items = EXAMPLES[kind] || [];
    box.innerHTML =
      '<span class="try">Try:</span>' +
      items
        .map(
          (item, index) =>
            `<button class="example" data-kind="${kind}" data-index="${index}">${esc(item.label)}</button>`
        )
        .join("");
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest(".example");
    if (!button || !button.dataset.kind) return;
    const kind = button.dataset.kind;
    const example = EXAMPLES[kind][Number(button.dataset.index)];
    if (kind === "vision") {
      loadSample(example.src);
      return;
    }
    const input = document.getElementById(`input-${kind}`);
    input.value = example.text;
    refreshJson(kind);
    run(kind);
  });
}

function prefill() {
  ["email", "support", "meeting", "contract"].forEach((kind) => {
    const input = document.getElementById(`input-${kind}`);
    if (input && EXAMPLES[kind] && EXAMPLES[kind][0]) input.value = EXAMPLES[kind][0].text;
  });
}

/* ---------- custom questions ---------- */

function questionBlock(question = { instructions: "", choices: [] }) {
  const choices = (question.choices || [])
    .map((choice) => `${choice.label}: ${choice.criteria || ""}`)
    .join("\n");
  return `<div class="qblock">
    <div class="qhead">
      <span class="qnum"></span>
      <input class="qtext" value="${esc(question.instructions)}" placeholder="What should Laya decide?">
      <button class="qremove" title="Remove question" aria-label="Remove question">×</button>
    </div>
    <textarea class="qchoices" spellcheck="false" placeholder="choice_label: what this choice means">${esc(choices)}</textarea>
    <span class="qmeta">One choice per line, as <code>label: criteria</code></span>
  </div>`;
}

function renumberQuestions() {
  $$("#questions-custom .qblock").forEach((block, index) => {
    $(".qnum", block).textContent = `Q${index + 1}`;
  });
}

function setQuestionBlocks(questions) {
  $("#questions-custom").innerHTML = questions.map(questionBlock).join("");
  renumberQuestions();
}

function readQuestions() {
  return $$("#questions-custom .qblock").map((block) => ({
    instructions: $(".qtext", block).value.trim(),
    choices: $(".qchoices", block).value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const split = line.indexOf(":");
        return split > 0
          ? { label: line.slice(0, split).trim(), criteria: line.slice(split + 1).trim() }
          : { label: line, criteria: "" };
      }),
  }));
}

function renderPresetChips() {
  const box = document.getElementById("presets-custom");
  box.innerHTML =
    '<span class="try">Standards:</span>' +
    Object.entries(state.presets)
      .map(([key, preset]) => `<button class="example" data-preset="${key}">${esc(preset.label)}</button>`)
      .join("");
}

async function ensurePresets() {
  if (state.presets) return state.presets;
  const response = await fetch("/api/presets");
  if (!response.ok) throw new Error(`Could not load standards (${response.status})`);
  state.presets = (await response.json()).presets;
  renderPresetChips();
  return state.presets;
}

function applyPreset(kind) {
  const preset = state.presets && state.presets[kind];
  if (!preset) return;
  setQuestionBlocks(preset.questions);
  const sample = kind === "vision" ? EXAMPLES.vision[0].text : EXAMPLES[kind]?.[0]?.text;
  if (sample) document.getElementById("input-custom").value = sample;
}

async function openCustom(kind) {
  selectTab("custom");
  try {
    await ensurePresets();
  } catch (error) {
    document.getElementById("out-custom").innerHTML = errorCard(error.message);
    return;
  }
  applyPreset(kind);
  if (kind === "vision") {
    if (state.lastVisionText) document.getElementById("input-custom").value = state.lastVisionText;
  } else {
    const source = document.getElementById(`input-${kind}`);
    if (source && source.value.trim()) document.getElementById("input-custom").value = source.value;
  }
  document.getElementById("out-custom").innerHTML =
    '<div class="placeholder">Edit anything, then press Ask Laya.</div>';
  document.getElementById("input-custom").focus();
}

document.addEventListener("click", (event) => {
  const preset = event.target.closest("[data-preset]");
  if (preset) {
    applyPreset(preset.dataset.preset);
    return;
  }
  const custom = event.target.closest("[data-custom]");
  if (custom) openCustom(custom.dataset.custom);
});

document.getElementById("add-question").addEventListener("click", () => {
  if ($$("#questions-custom .qblock").length >= 6) return;
  $("#questions-custom").insertAdjacentHTML("beforeend", questionBlock());
  renumberQuestions();
});

document.getElementById("questions-custom").addEventListener("click", (event) => {
  if (!event.target.closest(".qremove")) return;
  if ($$("#questions-custom .qblock").length <= 1) return;
  event.target.closest(".qblock").remove();
  renumberQuestions();
});

/* ---------- tabs ---------- */

function selectTab(name) {
  state.tab = name;
  $$(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.tab === name));
  $$(".tab-panel").forEach((panel) => panel.classList.toggle("active", panel.id === `panel-${name}`));
}

$$(".tab").forEach((tab) => {
  tab.addEventListener("click", () => selectTab(tab.dataset.tab));
});

$$("[data-run]").forEach((button) => {
  button.addEventListener("click", () => run(button.dataset.run));
});

/* ---------- health ---------- */

function applyLane(name, info) {
  const lane = document.getElementById(`lane-${name}`);
  if (!lane) return;
  lane.classList.remove("ready", "error", "off");
  const meta = lane.querySelector(".lane-meta");
  lane.title = info && info.error ? info.error : "";

  if (!info) {
    lane.classList.add("error");
    meta.textContent = "unknown";
    return;
  }
  if (info.state === "ready") {
    lane.classList.add("ready");
    meta.textContent = name === "text" ? `${info.model} · ready` : "windows · ready";
  } else if (info.state === "error") {
    lane.classList.add("error");
    meta.textContent = name === "ocr" ? "unavailable" : "failed to load";
  } else {
    meta.textContent = "loading…";
  }
}

function setBusyAvailability(health) {
  const textReady = !!health && health.text && health.text.state === "ready";
  const ocrReady = !!health && health.ocr && health.ocr.state === "ready";

  ["email", "support", "meeting", "contract", "custom"].forEach((kind) => {
    const button = document.querySelector(`[data-run="${kind}"]`);
    if (button) button.disabled = !textReady || !!state.busy[kind];
  });

  const visionButton = document.querySelector('[data-run="vision"]');
  if (visionButton) visionButton.disabled = !ocrReady || !!state.busy.vision;
}

async function pollHealth() {
  let again = true;
  try {
    const response = await fetch("/api/health");
    const health = await response.json();
    state.health = health;
    applyLane("text", health.text);
    applyLane("ocr", health.ocr);
    setBusyAvailability(health);
    again = health.text.state === "loading";
  } catch {
    again = true;
  }
  if (again) setTimeout(pollHealth, 2000);
}

/* ---------- running ---------- */

async function run(kind) {
  if (kind === "vision") return runVision();
  if (kind === "custom") return runCustom();
  if (state.busy[kind]) return;

  const input = document.getElementById(`input-${kind}`);
  const out = document.getElementById(`out-${kind}`);
  const button = document.querySelector(`[data-run="${kind}"]`);
  const text = input.value.trim();

  if (text.length < 10) {
    out.innerHTML = errorCard("Paste some text first.");
    return;
  }

  state.busy[kind] = true;
  setBusyAvailability(state.health);
  const label = button.textContent;
  button.textContent = "Working…";
  out.innerHTML = loadingCard("Deciding…");

  try {
    const response = await fetch(`/api/${kind}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, questions: readEdits(kind) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    out.innerHTML = RENDER[kind](data);
  } catch (error) {
    out.innerHTML = errorCard(error.message);
  } finally {
    state.busy[kind] = false;
    button.textContent = label;
    setBusyAvailability(state.health);
  }
}

/* ---------- vision ---------- */

function setVisionFile(file) {
  state.visionFile = file;
  if (state.visionUrl) URL.revokeObjectURL(state.visionUrl);
  state.visionUrl = URL.createObjectURL(file);

  const preview = document.getElementById("preview-vision");
  preview.src = state.visionUrl;
  preview.hidden = false;
  document.getElementById("drop-vision").classList.add("has-file");
}

async function loadSample(src) {
  try {
    const response = await fetch(src);
    if (!response.ok) throw new Error(`Could not load sample (${response.status})`);
    const blob = await response.blob();
    const name = src.split("/").pop();
    setVisionFile(new File([blob], name, { type: blob.type || "image/png" }));
    run("vision");
  } catch (error) {
    document.getElementById("out-vision").innerHTML = errorCard(error.message);
  }
}

async function runVision() {
  if (state.busy.vision) return;

  const out = document.getElementById("out-vision");
  const button = document.querySelector('[data-run="vision"]');
  if (!state.visionFile) {
    out.innerHTML = errorCard("Pick a sample, drop a file, or paste an image first.");
    return;
  }

  state.busy.vision = true;
  setBusyAvailability(state.health);
  const label = button.textContent;
  button.textContent = "Reading…";
  out.innerHTML = loadingCard("Reading the document…");

  try {
    const body = new FormData();
    body.append("file", state.visionFile, state.visionFile.name || "invoice.png");
    body.append("questions", JSON.stringify(readEdits("vision")));
    const response = await fetch("/api/invoice", { method: "POST", body });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    state.lastVisionText = data.text;
    refreshJson("vision");
    out.innerHTML = renderVision(data);
  } catch (error) {
    out.innerHTML = errorCard(error.message);
  } finally {
    state.busy.vision = false;
    button.textContent = label;
    setBusyAvailability(state.health);
  }
}

async function runCustom() {
  if (state.busy.custom) return;

  const out = document.getElementById("out-custom");
  const button = document.querySelector('[data-run="custom"]');
  const text = document.getElementById("input-custom").value.trim();
  const questions = readQuestions();

  if (text.length < 10) {
    out.innerHTML = errorCard("Paste some text first.");
    return;
  }
  if (!questions.length || questions.some((q) => q.instructions.length < 3)) {
    out.innerHTML = errorCard("Every question needs a sentence.");
    return;
  }
  if (questions.some((q) => q.choices.length < 2)) {
    out.innerHTML = errorCard("Every question needs at least two choices, one per line.");
    return;
  }

  state.busy.custom = true;
  setBusyAvailability(state.health);
  const label = button.textContent;
  button.textContent = "Working…";
  out.innerHTML = loadingCard("Deciding…");

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, questions }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.detail || `Request failed (${response.status})`);
    out.innerHTML = renderCustom(data);
  } catch (error) {
    out.innerHTML = errorCard(error.message);
  } finally {
    state.busy.custom = false;
    button.textContent = label;
    setBusyAvailability(state.health);
  }
}

const dropzone = document.getElementById("drop-vision");
const fileInput = document.getElementById("file-vision");

dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") fileInput.click();
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) setVisionFile(fileInput.files[0]);
});
dropzone.addEventListener("dragover", (event) => event.preventDefault());
dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  const file = event.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) {
    setVisionFile(file);
    run("vision");
  }
});
document.addEventListener("paste", (event) => {
  if (state.tab !== "vision") return;
  const item = [...(event.clipboardData?.items || [])].find((i) => i.type.startsWith("image/"));
  if (!item) return;
  const file = item.getAsFile();
  if (file) {
    event.preventDefault();
    setVisionFile(file);
    run("vision");
  }
});

/* ---------- keyboard ---------- */

document.addEventListener("keydown", (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.key !== "Enter") return;
  if (!event.target.matches("textarea")) return;
  event.preventDefault();
  run(state.tab);
});

/* ---------- what we ask Laya (editable questions + options, shown under the input) ---------- */

const QKINDS = ["email", "support", "meeting", "contract", "vision"];
const qdefaults = {};

function optRow(option = { label: "", criteria: "" }) {
  return `<div class="opt">
    <input class="o-label" value="${esc(option.label)}" placeholder="option" spellcheck="false">
    <input class="o-crit" value="${esc(option.criteria)}" placeholder="what it means" spellcheck="false">
    <button class="o-del" title="Remove option" aria-label="Remove option">×</button>
  </div>`;
}

function qCard(question, index) {
  return `<div class="qcard" data-id="${esc(question.id)}">
    <div class="qc-top"><span class="qc-n">Q${index + 1}</span><code class="qc-id">${esc(question.id)}</code>
      <span class="qc-count">${question.choices.length} options</span></div>
    <input class="qc-text" value="${esc(question.instructions)}" spellcheck="false">
    <div class="qc-head"><span>Option</span><span>What it means to the model</span></div>
    <div class="qc-opts">${question.choices.map(optRow).join("")}</div>
    <button class="ghost small o-add">+ option</button>
  </div>`;
}

function renderQPanel(kind) {
  const box = document.querySelector(`.qpanel[data-kind="${kind}"]`);
  const data = qdefaults[kind];
  if (!box || !data) return;
  box.innerHTML = `
    <div class="qp-head">
      <div><strong>What we ask Laya</strong><span class="muted"> · the questions and options the model chooses from. Editable.</span></div>
      <div class="qp-tools">
        <div class="seg"><button class="on" data-view="cards">Questions</button><button data-view="json">JSON</button></div>
        <button class="ghost small" data-reset>Reset</button>
      </div>
    </div>
    ${data.note ? `<div class="qp-note">${esc(data.note)}</div>` : ""}
    <div class="qp-cards">${data.questions.map(qCard).join("")}</div>
    <pre class="qp-json" hidden></pre>`;
}

function readEdits(kind) {
  const box = document.querySelector(`.qpanel[data-kind="${kind}"]`);
  if (!box || !$(".qcard", box)) return undefined;
  return $$(".qcard", box).map((card) => ({
    id: card.dataset.id,
    instructions: $(".qc-text", card).value.trim(),
    choices: $$(".opt", card)
      .map((row) => ({ label: $(".o-label", row).value.trim(), criteria: $(".o-crit", row).value.trim() }))
      .filter((choice) => choice.label),
  }));
}

function stateTextFor(kind) {
  if (kind === "vision") return state.lastVisionText || "(text read from the image by OCR)";
  const input = document.getElementById(`input-${kind}`);
  return input ? input.value.trim() : "";
}

function refreshJson(kind) {
  const box = document.querySelector(`.qpanel[data-kind="${kind}"]`);
  if (!box || !$(".qp-json", box)) return;
  const edits = readEdits(kind) || [];
  const text = stateTextFor(kind);
  const questions = {};
  edits.forEach((q) => {
    questions[q.id] = {
      type: "choice",
      instructions: q.instructions,
      criteria: Object.fromEntries(q.choices.map((c) => [c.label, c.criteria || c.label])),
    };
  });
  const shown = text.length > 160 ? `${text.slice(0, 160)}… (${text.length} characters in total)` : text;
  $(".qp-json", box).textContent = JSON.stringify({ state: shown, questions }, null, 2);
  $$(".qcard", box).forEach((card) => {
    $(".qc-count", card).textContent = `${$$(".opt", card).length} options`;
  });
}

function wireQPanels() {
  document.addEventListener("click", (event) => {
    const box = event.target.closest(".qpanel");
    if (!box) return;
    const kind = box.dataset.kind;
    const view = event.target.closest("[data-view]");
    if (view) {
      const json = view.dataset.view === "json";
      $$(".seg button", box).forEach((b) => b.classList.toggle("on", b === view));
      $(".qp-cards", box).hidden = json;
      $(".qp-json", box).hidden = !json;
      if (json) refreshJson(kind);
      return;
    }
    if (event.target.closest("[data-reset]")) {
      renderQPanel(kind);
      return;
    }
    if (event.target.closest(".o-add")) {
      const list = $(".qc-opts", event.target.closest(".qcard"));
      if ($$(".opt", list).length >= 12) return;
      list.insertAdjacentHTML("beforeend", optRow());
      $(".opt:last-child .o-label", list).focus();
      refreshJson(kind);
      return;
    }
    if (event.target.closest(".o-del")) {
      const list = event.target.closest(".qc-opts");
      if ($$(".opt", list).length <= 2) return;
      event.target.closest(".opt").remove();
      refreshJson(kind);
    }
  });
  document.addEventListener("input", (event) => {
    const box = event.target.closest(".qpanel");
    if (box) return refreshJson(box.dataset.kind);
    const match = /^input-(\w+)$/.exec(event.target.id || "");
    if (match && QKINDS.includes(match[1])) refreshJson(match[1]);
  });
}

async function buildQPanels() {
  QKINDS.forEach((kind) => {
    const actions = document.querySelector(`#panel-${kind} .input-actions`);
    if (!actions || document.querySelector(`.qpanel[data-kind="${kind}"]`)) return;
    actions.insertAdjacentHTML("beforebegin", `<div class="qpanel" data-kind="${kind}"></div>`);
  });
  try {
    const response = await fetch("/api/questions");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    Object.assign(qdefaults, await response.json());
    QKINDS.forEach(renderQPanel);
  } catch (error) {
    QKINDS.forEach((kind) => {
      const box = document.querySelector(`.qpanel[data-kind="${kind}"]`);
      if (box) box.innerHTML = errorCard(`Could not load the questions: ${error.message}`);
    });
  }
}

wireQPanels();

/* ---------- init ---------- */

buildExamples();
prefill();
buildQPanels();
ensurePresets()
  .then(() => {
    if (!$$("#questions-custom .qblock").length) applyPreset("email");
  })
  .catch((error) => {
    document.getElementById("presets-custom").innerHTML = errorCard(error.message);
  });
pollHealth();
