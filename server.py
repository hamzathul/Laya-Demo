"""Laya demo server: five decision demos plus a custom question editor, one text lane, OCR for images."""

import io
import json
import os
import re
import threading
import time
from collections import Counter
from contextlib import asynccontextmanager

os.environ.setdefault("USE_TF", "0")
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import laya
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image
from pydantic import BaseModel
from typing import Literal, Optional

try:  # Windows 10+ built-in OCR: no model download, ~0.1 s per page
    from winocr import recognize_pil_sync
    OCR_ERROR = None
except Exception as exc:  # noqa: BLE001 - surfaced in /api/health
    recognize_pil_sync = None
    OCR_ERROR = f"{type(exc).__name__}: {exc}"[:500]

BASE = os.path.dirname(os.path.abspath(__file__))
SAMPLES = os.path.join(BASE, "samples")

MODEL = os.getenv("LAYA_MODEL", "multilingual")
MODEL_IDS = {
    "multilingual": "multilingual",
    "english": "convaiinnovations/laya",
    "typed-decisions": "typed-decisions",
}
DEVICE = os.getenv("LAYA_DEVICE") or None

text_lock = threading.Lock()
ocr_lock = threading.Lock()

_text_agent = None
_text_state = "loading"
_text_error = None


def _load_text():
    global _text_agent, _text_state, _text_error
    try:
        agent = laya.load(MODEL_IDS.get(MODEL, MODEL), device=DEVICE)
        agent.predict("Warm up.", {"ok": {"type": "noul", "instructions": "Is this a warm up?"}})
        _text_agent = agent
        _text_state = "ready"
    except Exception as exc:  # noqa: BLE001 - surfaced in /api/health
        _text_error = f"{type(exc).__name__}: {exc}"[:500]
        _text_state = "error"


@asynccontextmanager
async def lifespan(_app):
    threading.Thread(target=_load_text, daemon=True).start()
    yield


app = FastAPI(title="Laya Demo", lifespan=lifespan)
app.mount("/static", StaticFiles(directory=os.path.join(BASE, "static")), name="static")
app.mount("/samples", StaticFiles(directory=SAMPLES), name="samples")


# --------------------------------------------------------------------------- helpers


class EditChoice(BaseModel):
    label: str
    criteria: str = ""


class EditQuestion(BaseModel):
    id: str
    instructions: str
    choices: list[EditChoice]


class TextIn(BaseModel):
    text: str
    # Optional edits from the UI: same question ids, new wording / options.
    questions: Optional[list[EditQuestion]] = None


def apply_edits(defaults, edits):
    """Return `defaults` with any valid UI edits applied. Ids are fixed; wording and options change."""
    if not edits:
        return defaults
    by_id = {e.id: e for e in edits}
    out = {}
    for qid, question in defaults.items():
        edit = by_id.get(qid)
        if edit is None:
            out[qid] = question
            continue
        instructions = (edit.instructions or "").strip()
        if len(instructions) < 3:
            raise HTTPException(400, f"'{qid}' needs a question sentence.")
        criteria = {}
        for choice in edit.choices:
            label = (choice.label or "").strip()
            if not label:
                continue
            if len(label) > 40:
                raise HTTPException(400, f"Option names must be 40 characters or fewer: {label[:40]}…")
            if label in criteria:
                raise HTTPException(400, f"'{qid}' has two options named '{label}'.")
            criteria[label] = (choice.criteria or "").strip()[:300] or label
        if not 2 <= len(criteria) <= 12:
            raise HTTPException(400, f"'{qid}' needs 2 to 12 options.")
        out[qid] = {"type": "choice", "instructions": instructions[:300], "criteria": criteria}
    return out


def _clean(text: str) -> str:
    text = (text or "").strip()
    if len(text) < 10:
        raise HTTPException(400, "Paste some text first.")
    return text[:12000]


def _require_text():
    if _text_state == "error":
        raise HTTPException(503, f"Text model failed to load: {_text_error}")
    if _text_agent is None:
        raise HTTPException(503, "Text model is still loading — try again in a few seconds.")
    return _text_agent


def ask_text(state, questions, head_max_len=None):
    agent = _require_text()
    # All question prompts share one option budget; a dozen questions need more than the 192 default.
    budget = head_max_len or min(1536, max(256, 32 * len(questions)))
    with text_lock:
        return agent.predict(state, questions, max_len=2048, head_max_len=budget)


def ask_batch(states, questions):
    agent = _require_text()
    with text_lock:
        return agent.predict_batch(states, questions, max_len=2048)


def _confidence(answer):
    conf = answer.get("answer_confidence")
    if conf is None and answer.get("probabilities"):
        conf = max(answer["probabilities"].values())
    return round(float(conf or 0), 3)


def choice_answer(result, qid):
    answer = result["answers"][qid]
    return {
        "label": answer.get("choice"),
        "confidence": _confidence(answer),
        "probs": {k: round(float(v), 3) for k, v in (answer.get("probabilities") or {}).items()},
        "route": answer.get("route"),
        "abstain": answer.get("abstain"),
    }


def _ms(start):
    return int((time.perf_counter() - start) * 1000)


def _explain(calls):
    """The exact model input, for the developer view in the UI."""
    packed = []
    for kind, states, questions in calls:
        packed.append({
            "kind": kind,
            "states": [str(state) for state in (states if isinstance(states, list) else [states])],
            "questions": [
                {
                    "id": qid,
                    "instruction": question["instructions"],
                    "choices": [
                        {"label": label, "criteria": criteria}
                        for label, criteria in question["criteria"].items()
                    ],
                }
                for qid, question in questions.items()
            ],
        })
    return packed


# --------------------------------------------------------------------------- email

EMAIL_QUESTIONS = {
    "category": {
        "type": "choice",
        "instructions": "Which category best describes this email?",
        "criteria": {
            "complaint": "billing dispute, duplicate charge, refund demand, bad product or bad service; the customer is unhappy and wants it fixed",
            "sales_enquiry": "pricing, quote, demo, trial, purchase or partnership request",
            "urgent_request": "outage, security incident, blocked checkout, or a hard deadline within hours",
            "general_enquiry": "policy, documentation, hours, or vendor-register question",
        },
    },
    "intent": {
        "type": "choice",
        "instructions": "What does the sender want?",
        "criteria": {
            "refund_or_compensation": "money back, a credit, or compensation for a problem",
            "report_problem": "report a bug, outage, damaged item or other failure",
            "request_information": "ask for information, a document or a status update",
            "request_quote": "ask for pricing, a proposal or a quote",
            "schedule_meeting": "ask for a call, demo or meeting",
            "cancel_or_leave": "cancel, downgrade, or move to another vendor",
            "other": "anything else",
        },
    },
    "needs_human": {
        "type": "choice",
        "instructions": "Should a human reply personally, or can an automated response handle this?",
        "criteria": {
            "human": "the customer is upset, money or work is at risk, or the issue needs judgment",
            "automated": "a routine question that a template can answer",
        },
    },
}


@app.post("/api/email")
def email(inp: TextIn):
    text = _clean(inp.text)
    questions = apply_edits(EMAIL_QUESTIONS, inp.questions)
    start = time.perf_counter()
    result = ask_text(text, questions)
    return {
        "ms": _ms(start),
        "category": choice_answer(result, "category"),
        "intent": choice_answer(result, "intent"),
        "needs_human": choice_answer(result, "needs_human"),
        "input": _explain([("single", text, questions)]),
        "raw": result["answers"],
    }


# --------------------------------------------------------------------------- support

SUPPORT_QUESTIONS = {
    "sentiment": {
        "type": "choice",
        "instructions": "What is the customer's emotional tone?",
        "criteria": {
            "angry": "hostile, threatening to leave, or writing in capitals",
            "frustrated": "unhappy about a problem and wants it fixed, even if polite",
            "neutral": "a routine question with no problem or complaint",
        },
    },
    "category": {
        "type": "choice",
        "instructions": "Which team should handle this complaint?",
        "criteria": {
            "billing": "charges, invoices, refunds, payments",
            "delivery": "shipping, courier, late or missing orders",
            "product_defect": "damaged, faulty or incorrect item",
            "account_access": "login, password reset, locked or compromised account",
            "other": "anything else",
        },
    },
    "priority": {
        "type": "choice",
        "instructions": "How urgently should this be handled?",
        "criteria": {
            "low": "no urgency, can wait several days",
            "medium": "should be answered today",
            "high": "blocking the customer's work or money is at risk",
            "critical": "outage, security incident, legal threat or total loss of access",
        },
    },
    "reply_template": {
        "type": "choice",
        "instructions": "Which reply should the agent send first?",
        "criteria": {
            "billing_fix": "confirm the charge issue and start a refund",
            "delivery_trace": "open a courier trace and promise an update",
            "replacement": "send a replacement for a damaged or faulty item",
            "account_recovery": "send a secure reset link or unlock the account",
            "escalate": "hand over to a senior specialist",
            "general": "acknowledge, log the case and promise next steps",
        },
    },
}

@app.post("/api/support")
def support(inp: TextIn):
    text = _clean(inp.text)
    questions = apply_edits(SUPPORT_QUESTIONS, inp.questions)
    start = time.perf_counter()
    result = ask_text(text, questions)
    reply = choice_answer(result, "reply_template")
    return {
        "ms": _ms(start),
        "sentiment": choice_answer(result, "sentiment"),
        "category": choice_answer(result, "category"),
        "priority": choice_answer(result, "priority"),
        "reply_template": reply,
        "input": _explain([("single", text, questions)]),
        "raw": result["answers"],
    }


# --------------------------------------------------------------------------- meeting

SENT_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+|;\s+|\s+[—–]\s+")
NAME_RE = re.compile(r"\b([A-Z][a-z]{2,})\b")
HEADER_RE = re.compile(r"^(attendees|present|participants|in attendance)\b", re.IGNORECASE)
FUTURE_RE = re.compile(r"\b(will|is going to|are going to|needs? to|must|has to|have to)\b", re.IGNORECASE)
DATE_RE = re.compile(
    r"\b(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b"
    r"|(?:\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\b)"
    r"|\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b"
    r"|\b(?:today|tomorrow|tonight|next week|next month|end of (?:day|week|month)|EOD|EOW|Q[1-4])\b"
    r"|\bweek of [A-Z][a-z]+ \d{1,2}\b",
    re.IGNORECASE,
)

NAME_STOP = {
    "The", "This", "That", "These", "Those", "There", "Then", "They", "Their", "Them",
    "Our", "You", "Your", "Please", "Thanks", "Thank", "Next", "Also", "And", "But", "For",
    "Not", "All", "Can", "Will", "Would", "Should", "Could", "When", "What", "Where",
    "Which", "Who", "Why", "How", "Meeting", "Project", "Team", "Client", "Customer",
    "Product", "Update", "Action", "Deadline", "Attendees", "Present", "App", "Store",
    "Beta", "Marketing", "Budget", "Security", "Dublin", "Horizon", "Bank", "Launch",
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    "January", "February", "March", "April", "May", "June", "July", "August",
    "September", "October", "November", "December", "Q1", "Q2", "Q3", "Q4", "EOD", "EOW",
}


def split_sentences(text, cap=16):
    out = []
    for part in SENT_SPLIT.split(text):
        part = re.sub(r"\s+", " ", part).strip(" \t-•*")
        if len(part) >= 15:
            out.append(part)
        if len(out) >= cap:
            break
    return out


def find_names(text, cap=8):
    """Names from the attendee lines first; then any other capitalised name."""
    out = []
    for line in text.splitlines():
        if not HEADER_RE.match(line.strip()):
            continue
        for word in re.split(r"[,;/]| and ", line.split(":", 1)[-1]):
            name = re.sub(r"[^A-Za-z ]", " ", word).strip().split(" ")[0]
            if len(name) >= 3 and name[0].isupper() and name not in NAME_STOP and name not in out:
                out.append(name)
    for name in NAME_RE.findall(text):
        if len(out) >= cap:
            break
        if name in NAME_STOP or name in out:
            continue
        out.append(name)
    return out[:cap]


MEETING_KIND = {
    "type": "choice",
    "instructions": "What is this line from meeting notes?",
    "criteria": {
        "action": "a person commits to do work after the meeting",
        "decision": "the group agreed or decided something",
        "info": "attendees, schedule, status, or background",
    },
}


@app.post("/api/meeting")
def meeting(inp: TextIn):
    text = _clean(inp.text)
    lines = split_sentences(text)
    names = find_names(text)
    if not lines:
        raise HTTPException(400, "Paste a few sentences of meeting notes.")

    questions = apply_edits({"kind": MEETING_KIND}, inp.questions)
    if names:
        questions["owner"] = {
            "type": "choice",
            "instructions": "Who is responsible for doing something after the meeting because of this line?",
            "criteria": {
                **{name: f"{name} has to do something" for name in names},
                "nobody": "no individual owns follow-up work here; it is a decision, an attendee list, or scheduling",
            },
        }

    start = time.perf_counter()
    results = ask_batch(lines, questions)
    ms = _ms(start)

    actions, decisions = [], []
    for line, result in zip(lines, results):
        answers = result["answers"]
        kind = answers["kind"]
        owner, owner_prob = "nobody", 0.0
        if "owner" in answers:
            owner = answers["owner"].get("choice") or "nobody"
            owner_prob = float((answers["owner"].get("probabilities") or {}).get(owner) or 0)
        future = bool(FUTURE_RE.search(line)) and not HEADER_RE.match(line)
        by_model = owner != "nobody" and owner_prob >= 0.5
        # The owner question sometimes answers "nobody" on a plain "Name will do X" line;
        # a single attendee name plus a future cue is still an action.
        subject = next((n for n in names if re.search(rf"\b{re.escape(n)}\b", line)), None)
        if future and (by_model or subject):
            date = DATE_RE.search(line)
            actions.append({
                "text": line,
                "owner": owner if by_model else subject,
                "owner_confidence": round(owner_prob, 3) if by_model else None,
                "prob": round(float((kind.get("probabilities") or {}).get("action") or 0), 3),
                "deadline": date.group(0) if date else None,
            })
        elif kind.get("choice") == "decision" and _confidence(kind) >= 0.7:
            # shortcut: short fragments land at 0.5-0.7 as "decision"; hide them rather than show noise.
            decisions.append({
                "text": line,
                "prob": round(float((kind.get("probabilities") or {}).get("decision") or 0), 3),
            })

    return {
        "ms": ms,
        "actions": actions,
        "decisions": decisions,
        "people": sorted({a["owner"] for a in actions}),
        "deadlines": [a["deadline"] for a in actions if a["deadline"]],
        "scanned": {"lines": len(lines), "names": len(names)},
        "input": _explain([("batch", lines, questions)]),
        "raw": [{"line": line, **result["answers"]} for line, result in zip(lines, results)],
    }


# --------------------------------------------------------------------------- contract

CONTRACT_TYPE = {
    "type": {
        "type": "choice",
        "instructions": "What kind of contract is this?",
        "criteria": {
            "nda": "non-disclosure or confidentiality agreement",
            "msa": "master services or professional services agreement",
            "sow": "statement of work",
            "lease": "property or equipment lease",
            "employment": "employment or contractor agreement",
            "other": "anything else",
        },
    },
}

TOPIC_QUESTION = {
    "topic": {
        "type": "choice",
        "instructions": "What is this section of the contract about?",
        "criteria": {
            "liability": "limitation of liability or indemnity",
            "termination": "ending the contract, or terminating for convenience or breach",
            "term": "duration, renewal or extension of the contract",
            "payment": "fees, invoices or payment terms",
            "assignment": "assigning, subletting or transferring the contract",
            "governing_law": "which jurisdiction's law applies",
            "confidentiality": "keeping information secret after the agreement",
            "data_protection": "processing personal data, GDPR or security measures",
            "exclusivity": "exclusivity, non-compete or restricting other partners",
            "other": "anything else",
        },
    },
}

REVIEWER = {
    "liability": "Legal",
    "termination": "Legal",
    "governing_law": "Legal",
    "assignment": "Legal",
    "exclusivity": "Legal",
    "confidentiality": "Legal",
    "payment": "Finance",
    "term": "Commercial",
    "data_protection": "Privacy",
    "other": "Commercial",
}


def split_contract(text):
    blocks = [b.strip() for b in re.split(r"\n\s*\n", text) if b.strip()]
    if len(blocks) <= 1:
        blocks = [b.strip() for b in re.split(r"(?m)^(?=\s*\d{1,2}\.\s)", text) if b.strip()]
    numbered = [b for b in blocks if re.match(r"^\d{1,2}\.\s", b)]
    if numbered:
        blocks = numbered
    out = []
    for block in blocks:
        match = re.match(r"^(\d{1,2}\.\s+[^.\n]{2,60})", block)
        heading = match.group(1).strip() if match else block[:60].strip()
        body = re.sub(r"\s+", " ", block)[:1200]
        out.append({"heading": heading, "text": body})
    return out[:20]


@app.post("/api/contract")
def contract(inp: TextIn):
    text = _clean(inp.text)
    sections = split_contract(text)
    if not sections:
        raise HTTPException(400, "Paste a contract or an excerpt with numbered clauses.")

    type_questions = apply_edits(CONTRACT_TYPE, inp.questions)
    topic_questions = apply_edits(TOPIC_QUESTION, inp.questions)
    start = time.perf_counter()
    type_result = ask_text(text, type_questions)
    topic_results = ask_batch([s["text"] for s in sections], topic_questions)

    rows = []
    for section, result in zip(sections, topic_results):
        answer = result["answers"]["topic"]
        topic = answer.get("choice") or "other"
        rows.append({
            "heading": section["heading"],
            "preview": section["text"][:220],
            "topic": topic,
            "confidence": _confidence(answer),
            "probs": {k: round(float(v), 3) for k, v in (answer.get("probabilities") or {}).items()},
            "owner": REVIEWER.get(topic, "Commercial"),
        })
    counts = Counter(row["owner"] for row in rows)

    return {
        "ms": _ms(start),
        "type": choice_answer(type_result, "type"),
        "sections": rows,
        "counts": dict(counts.most_common()),
        "input": _explain([
            ("single", text, type_questions),
            ("batch", [section["text"] for section in sections], topic_questions),
        ]),
        "raw": {
            "type": type_result["answers"]["type"],
            "sections": [result["answers"]["topic"] for result in topic_results],
        },
    }


# --------------------------------------------------------------------------- invoice

INVOICE_QUESTIONS = {
    "doc_type": {
        "type": "choice",
        "instructions": "Which title is printed on this document?",
        "criteria": {
            "invoice": "INVOICE",
            "freight_invoice": "FREIGHT INVOICE",
            "credit_note": "CREDIT NOTE",
            "debit_note": "DEBIT NOTE",
            "receipt": "PAYMENT RECEIPT",
            "purchase_order": "PURCHASE ORDER",
            "statement": "ACCOUNT STATEMENT",
            "other": "no title, or a different title",
        },
    },
}

PO_RE = re.compile(r"\bPO[- ]?\d{2,4}[- ]?\d{3,5}\b", re.IGNORECASE)


def payment_mark(text, doc_type):
    """Read the stamp/status words from the OCR text; the model was unreliable at this."""
    upper = text.upper()
    if "OVERDUE" in upper:
        return "overdue"
    if "PAID IN FULL" in upper or re.search(r"\bPAID\b", upper):
        return "paid"
    if doc_type == "credit_note":
        return "credit"
    if doc_type == "statement":
        return "summary"
    return "open"


@app.post("/api/invoice")
def invoice(file: UploadFile = File(...), questions: Optional[str] = Form(None)):
    if recognize_pil_sync is None:
        raise HTTPException(503, f"OCR is unavailable: {OCR_ERROR}")
    data = file.file.read()
    if len(data) > 15_000_000:
        raise HTTPException(400, "Image is larger than 15 MB.")
    try:
        image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(400, "That file is not an image.")
    image.thumbnail((2000, 2000))

    start = time.perf_counter()
    try:
        with ocr_lock:
            text = (recognize_pil_sync(image, "en") or {}).get("text") or ""
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(503, f"OCR failed on this image: {type(exc).__name__}: {exc}")
    ocr_ms = _ms(start)
    if len(text.strip()) < 20:
        raise HTTPException(422, "Could not read enough text from that image — try a sharper photo.")

    edits = None
    if questions:
        try:
            edits = [EditQuestion(**item) for item in json.loads(questions)]
        except Exception:
            raise HTTPException(400, "Could not read the edited questions.")
    invoice_questions = apply_edits(INVOICE_QUESTIONS, edits)
    result = ask_text(text, invoice_questions)
    doc = choice_answer(result, "doc_type")
    po_numbers = list(dict.fromkeys(PO_RE.findall(text)))
    return {
        "ms": _ms(start),
        "ocr_ms": ocr_ms,
        "text": text.strip()[:4000],
        "doc_type": doc,
        "po_numbers": po_numbers[:20],
        "po_count": len(po_numbers),
        "payment_mark": payment_mark(text, doc["label"]),
        "input": _explain([("single", text, invoice_questions)]),
        "raw": result["answers"],
    }


# --------------------------------------------------------------------------- custom questions


class ChoiceIn(BaseModel):
    label: str
    criteria: str = ""


class QuestionIn(BaseModel):
    instructions: str
    choices: list[ChoiceIn]


class AskIn(BaseModel):
    text: str
    questions: list[QuestionIn]


@app.post("/api/ask")
def ask(inp: AskIn):
    text = _clean(inp.text)[:6000]
    if not 1 <= len(inp.questions) <= 6:
        raise HTTPException(400, "Give between 1 and 6 questions.")
    questions = {}
    for index, question in enumerate(inp.questions, 1):
        instructions = (question.instructions or "").strip()
        if len(instructions) < 3:
            raise HTTPException(400, f"Question {index} needs a question sentence.")
        criteria = {}
        for choice in question.choices:
            label = (choice.label or "").strip()
            if not label:
                continue
            if len(label) > 40:
                raise HTTPException(400, f"Choice labels must be 40 characters or fewer: {label[:40]}…")
            if label in criteria:
                raise HTTPException(400, f"Question {index} has two choices named '{label}'.")
            criteria[label] = (choice.criteria or "").strip()[:300] or label
        if not 2 <= len(criteria) <= 12:
            raise HTTPException(400, f"Question {index} needs 2 to 12 choices.")
        questions[f"q{index}"] = {
            "type": "choice",
            "instructions": instructions[:300],
            "criteria": criteria,
        }

    start = time.perf_counter()
    result = ask_text(text, questions, head_max_len=512)
    answers = []
    for qid, question in questions.items():
        answer = choice_answer(result, qid)
        answer["question"] = question["instructions"]
        answers.append(answer)
    return {
        "ms": _ms(start),
        "answers": answers,
        "input": _explain([("single", text, questions)]),
        "raw": result["answers"],
    }


def _pack(*question_sets):
    packed = []
    for question_set in question_sets:
        for question in question_set.values():
            packed.append({
                "instructions": question["instructions"],
                "choices": [
                    {"label": label, "criteria": criteria}
                    for label, criteria in question["criteria"].items()
                ],
            })
    return packed


PRESETS = {
    "email": {"label": "Email triage", "questions": _pack(EMAIL_QUESTIONS)},
    "support": {"label": "Support ticket", "questions": _pack(SUPPORT_QUESTIONS)},
    "meeting": {"label": "Meeting line", "questions": _pack({"kind": MEETING_KIND})},
    "contract": {"label": "Contract clause", "questions": _pack(TOPIC_QUESTION)},
    "vision": {"label": "Document type", "questions": _pack(INVOICE_QUESTIONS)},
}


def _editable(question_sets, note=None):
    items = []
    for question_set in question_sets:
        for qid, question in question_set.items():
            items.append({
                "id": qid,
                "instructions": question["instructions"],
                "choices": [{"label": k, "criteria": v} for k, v in question["criteria"].items()],
            })
    return {"questions": items, "note": note}


@app.get("/api/questions")
def default_questions():
    """The questions and options each tab sends to Laya; the UI shows and edits these."""
    return {
        "email": _editable([EMAIL_QUESTIONS]),
        "support": _editable([SUPPORT_QUESTIONS]),
        "meeting": _editable(
            [{"kind": MEETING_KIND}],
            "Each line of the notes is sent separately. A second question, “who owns this?”, is built automatically from the names found in the notes.",
        ),
        "contract": _editable(
            [CONTRACT_TYPE, TOPIC_QUESTION],
            "“type” is asked once on the whole text; “topic” is asked once per numbered clause.",
        ),
        "vision": _editable([INVOICE_QUESTIONS], "The text is read from the image by OCR, then sent as the state."),
    }


# --------------------------------------------------------------------------- playground: typed questions
# One endpoint, three question types (choice / yes_no / score). Nothing is added to Laya's answers:
# the response is Laya's own output, reshaped into one clear structure per type.


class PgQuestion(BaseModel):
    id: Optional[str] = None
    type: Literal["choice", "yes_no", "score"] = "choice"
    instructions: str
    choices: Optional[list[EditChoice]] = None  # choice: label + what it means
    levels: Optional[list[str]] = None          # score: level descriptions, lowest first
    yes: Optional[str] = None                   # yes_no: optional meaning of "yes"
    no: Optional[str] = None                    # yes_no: optional meaning of "no"


class PgIn(BaseModel):
    text: str
    questions: list[PgQuestion]


def _pg_laya_question(q: PgQuestion, index: int):
    instructions = (q.instructions or "").strip()
    if len(instructions) < 3:
        raise HTTPException(400, f"Question {index} needs a question sentence.")
    if q.type == "choice":
        criteria = {}
        for choice in q.choices or []:
            label = (choice.label or "").strip()
            if not label:
                continue
            if len(label) > 40:
                raise HTTPException(400, f"Question {index}: option names must be 40 characters or fewer.")
            if label in criteria:
                raise HTTPException(400, f"Question {index} has two options named '{label}'.")
            criteria[label] = (choice.criteria or "").strip()[:300] or label
        if not 2 <= len(criteria) <= 12:
            raise HTTPException(400, f"Question {index}: a choice question needs 2 to 12 options.")
        return {"type": "choice", "instructions": instructions[:300], "criteria": criteria}
    if q.type == "score":
        levels = [(level or "").strip()[:300] for level in (q.levels or []) if (level or "").strip()]
        if not 2 <= len(levels) <= 10:
            raise HTTPException(400, f"Question {index}: a score question needs 2 to 10 levels.")
        return {"type": "score", "instructions": instructions[:300], "criteria": levels}
    out = {"type": "noul", "instructions": instructions[:300]}
    criteria = {}
    if (q.yes or "").strip():
        criteria["true"] = q.yes.strip()[:300]
    if (q.no or "").strip():
        criteria["false"] = q.no.strip()[:300]
    if criteria:
        out["criteria"] = criteria
    return out


def _pg_shape(q: PgQuestion, qid: str, answer: dict):
    confidence = round(float(answer.get("answer_confidence") or answer.get("confidence") or 0), 3)
    base = {
        "id": qid,
        "type": q.type,
        "question": q.instructions.strip(),
        "confidence": confidence,
        "route": answer.get("route"),
        "abstain": answer.get("abstain"),
    }
    if q.type == "yes_no":
        p_yes = round(float(answer.get("noul") or 0), 3)
        return {**base, "answer": "yes" if p_yes >= 0.5 else "no", "p_yes": p_yes}
    probs = {k: round(float(v), 3) for k, v in (answer.get("probabilities") or {}).items()}
    if q.type == "score":
        levels = [(level or "").strip() for level in (q.levels or []) if (level or "").strip()]
        return {
            **base,
            "answer": round(float(answer.get("score") or 0), 2),
            "scale": {"min": 0, "max": max(len(levels) - 1, 1)},
            "levels": {str(i): level for i, level in enumerate(levels)},
            "probs": probs,
        }
    return {**base, "answer": answer.get("choice"), "probs": probs}


@app.post("/api/decide")
def decide(inp: PgIn):
    text = (inp.text or "").strip()
    if len(text) < 10:
        raise HTTPException(400, "Type or paste some text first (at least 10 characters).")
    text = text[:20000]
    if not 1 <= len(inp.questions) <= 8:
        raise HTTPException(400, "Give between 1 and 8 questions.")

    questions, defs = {}, []
    for index, q in enumerate(inp.questions, 1):
        qid = (q.id or f"q{index}").strip() or f"q{index}"
        if qid in questions:
            qid = f"{qid}_{index}"
        questions[qid] = _pg_laya_question(q, index)
        defs.append((qid, q))

    start = time.perf_counter()
    result = ask_text(text, questions)
    return {
        "ms": _ms(start),
        "answers": [_pg_shape(q, qid, result["answers"][qid]) for qid, q in defs],
        "raw": result["answers"],  # Laya's own output, untouched
    }


@app.post("/api/ocr")
def ocr(file: UploadFile = File(...)):
    if recognize_pil_sync is None:
        raise HTTPException(503, f"OCR is unavailable: {OCR_ERROR}")
    data = file.file.read()
    if len(data) > 15_000_000:
        raise HTTPException(400, "Image is larger than 15 MB.")
    try:
        image = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(400, "That file is not an image.")
    image.thumbnail((2000, 2000))
    start = time.perf_counter()
    try:
        with ocr_lock:
            text = (recognize_pil_sync(image, "en") or {}).get("text") or ""
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(503, f"OCR failed on this image: {type(exc).__name__}: {exc}")
    if len(text.strip()) < 20:
        raise HTTPException(422, "Could not read enough text from that image — try a sharper photo.")
    return {"ms": _ms(start), "text": text.strip()[:6000]}


@app.get("/api/presets")
def presets():
    return {"presets": PRESETS}


# --------------------------------------------------------------------------- app


@app.get("/api/health")
def health():
    return {
        "text": {"state": _text_state, "model": MODEL, "error": _text_error},
        "ocr": {"state": "error" if recognize_pil_sync is None else "ready", "error": OCR_ERROR},
    }


@app.get("/")
def index():
    return FileResponse(os.path.join(BASE, "static", "playground.html"))


@app.get("/classic")
def classic():
    """The earlier tabbed demo, kept as it was."""
    return FileResponse(os.path.join(BASE, "static", "index.html"))
