# Laya System 1 demos

Six local demos built on [Laya](https://github.com/NandhaKishorM/laya), a non-autoregressive decision model. Laya reads a state and answers **typed questions** with probabilities. It never generates text — every reply line in this app is a template chosen by the model.

One text checkpoint (322 MB, CPU), one Windows OCR call for images. No network after the first run.

## The demos

| Tab | Input | What Laya decides | Typical time |
|---|---|---|---|
| **Email** | an email | category, intent, human vs automated reply, reply template | 0.9 s |
| **Support** | a complaint | sentiment, team, priority, reply template | 0.5 s |
| **Meeting** | meeting notes | action items with owner + deadline, decisions | 1.6 s |
| **Contract** | contract excerpt | contract type, topic and reviewer for every clause | 1.0 s |
| **Invoice photo** | image | document type; payment mark and PO numbers read from the OCR text | 0.8 s |
| **Custom** | any text | whatever questions and choices you type | 0.5–1 s |

Every tab has **example chips**: one click fills the input *and* runs it. The invoice tab also accepts a dropped file, a picked file, or `Ctrl+V`.

The **Custom** tab is the live editor: pick one of five standards (the question sets the other tabs use), then edit the state text, the question sentence and the `label: criteria` choices in front of the audience. The prebuilt examples are only time savers.

The invoice tab ships eight synthetic documents: standard invoice, one invoice covering three POs, overdue invoice, freight invoice, credit note, debit note, payment receipt and account statement. The document type is a literal title question (INVOICE / FREIGHT INVOICE / CREDIT NOTE / …), which was the only formulation that scored 8/8 across repeated runs.

## Setup (once)

```bat
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe tools\make_samples.py
```

The first run downloads the text checkpoint (~322 MB) from Hugging Face. After that the app runs fully offline.

The invoice tab uses the OCR built into Windows 10/11 (`winocr`), so it needs no model download and no GPU.

## Run

```bat
run.bat
```

Or manually:

```bat
.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8000
```

Open <http://127.0.0.1:8000>. The header shows two dots: the text model and OCR. Buttons enable when they are ready.

## Suggested demo order

1. **Email → Refund complaint** — complaint 100%, refund intent, human reply, apology template. Point at the probability bars. Then **Pricing enquiry** to show the same model flipping to sales/automated, and **Production outage** for urgent.
2. **Support → Double charge** — frustrated, billing, medium, billing-fix template. Then **Account locked** for a critical priority.
3. **Meeting → Launch sync** — the speed showcase: ten lines, three actions with owners and dates, three decisions, in one batched pass. Then **Client kickoff** to show it picks up different names.
4. **Contract → Services MSA** — type 100%, then each clause routed: Legal, Finance, Privacy. Then **Mutual NDA** and **Office lease**.
5. **Invoice photo → Overdue invoice** — the OCR text appears alongside the decisions, so the audience can check them. Then walk the chips: standard, multi-PO (three PO chips appear), freight, credit note, debit note, receipt, statement. Drop or paste any document you brought.
6. **Custom → Standard: Email triage** — change a choice label or criteria live, adjust the question sentence, press Ask Laya. Switch the standard to another tab's question set to show it is the same machinery.

## How it works

```
browser (static HTML/JS)
   └── FastAPI
        ├── text lane:  laya.load("multilingual")   one forward pass per request
        └── invoice:    Windows OCR → same text lane
```

- The model loads at startup in a background thread; inference is locked so two requests never share it.
- A request builds one question dict and calls `predict` once. The meeting and contract tabs use `predict_batch`, one call for all lines/clauses.
- The frontend is one static page — no build step, no CDN, no network calls except the local API.
- Reply templates live in `server.py`; the model only chooses which one to send.

### What each tab actually asks

- **Meeting**: each line gets two questions — *is it an action, decision or info?* and *who owns follow-up work here?* A line is an action when it has a future-tense cue (`will`, `is going to`, `needs to`, `has to`) and either a model owner above 50% or a single attendee name in the line. Decisions below 70% confidence are hidden. Deadlines are regex-extracted from the action line.
- **Contract**: the text is split on numbered clauses; each clause gets a 10-way topic choice; the topic maps to a reviewer (Legal/Finance/Privacy/Commercial). There is deliberately no risk score.
- **Invoice**: OCR returns the text; Laya answers one choice question on that text: *which title is printed?* Payment mark and PO numbers are read from the OCR text with fixed rules (OVERDUE/PAID stamps, `PO-2026-118` pattern) because the model was unreliable at both. This is why the OCR text is shown: the decisions are about the text, not about pixels.
- **Custom**: `/api/ask` builds the choice questions from the editor and calls the same text lane with `head_max_len=512`. Limits: 1–6 questions, 2–12 choices each, label ≤ 40 characters, criteria ≤ 300. Choices are typed one per line as `label: criteria`.

## Configuration

| Variable | Default | Meaning |
|---|---|---|
| `LAYA_MODEL` | `multilingual` | text checkpoint: `multilingual`, `english`, or `typed-decisions` |
| `LAYA_DEVICE` | auto | `cpu`, `cuda`, `mps`, `xpu` |

`english` and `typed-decisions` were measured too: they were 3–4× slower and not more accurate on these examples, so `multilingual` is the default.

## Honest limits

- **No generation.** The reply lines are canned templates selected by Laya. Do not present them as generated text.
- **The invoice tab is OCR + decisions, not a vision model.** Laya's 0.4.38 vision path (`laya.Agent(vegaml=True)`) was measured at 30–75 s per image on this CPU and got amount/status fields wrong, so it is not used. Windows OCR reads the page in ~0.1 s and Laya decides on the text.
- **Invoice type is title matching.** The model reads the printed title, not the business meaning of the page. A document with no clear title falls to "other". Payment status and PO count are rule-based, not model decisions, and are labelled that way in the UI.
- **Contract is routing, not risk scoring.** Zero-shot clause risk was unusable (every clause scored 0.9+ on every contract, including absent ones), so the tab classifies clause topics instead.
- **Meeting is a hybrid.** Lines come from punctuation/newlines; owners are a model choice among the names in the notes; deadlines are regex. It misses pronouns ("she will send it") and compound lines with two owners.
- **Calibration.** Treat raw probabilities as a ranking; use `route`/`abstain` when they are present.
- **English text, Windows OCR.** The UI and examples are English; the invoice tab needs Windows 10+ with an English OCR language pack.

## Troubleshooting

- **Buttons stay disabled** — `GET /api/health` shows the exact load state and error.
- **OCR unavailable** — install the English OCR language pack (Settings → Time & Language → Language → English → Options → OCR). Text tabs still work.
- **Model load hangs** — `USE_TF=0` is set by `run.bat`; `transformers` can deadlock when TensorFlow is installed.
- **Port in use** — `uvicorn server:app --port 8001` and open that port.
