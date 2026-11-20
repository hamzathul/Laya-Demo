"""Generate the synthetic business documents used by the invoice demo."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "samples"
FONT_DIR = Path("C:/Windows/Fonts")

NAVY = (23, 42, 69)
GRAY = (110, 118, 128)
LIGHT = (238, 240, 243)
BLACK = (20, 22, 26)
RED = (190, 30, 45)
GREEN = (22, 120, 80)
AMBER = (170, 110, 20)


def font(size, bold=False):
    name = "arialbd.ttf" if bold else "arial.ttf"
    try:
        return ImageFont.truetype(str(FONT_DIR / name), size)
    except OSError:
        return ImageFont.load_default(size=size)


def draw_doc(
    path,
    *,
    title,
    company,
    address,
    vat,
    meta,
    bill_to,
    items,
    totals,
    total_label,
    total,
    footer,
    stamp=None,
    stamp_color=RED,
    po_list=None,
):
    width, height = 1000, 1250
    img = Image.new("RGB", (width, height), "white")
    d = ImageDraw.Draw(img)

    d.rectangle([0, 0, width, 150], fill=NAVY)
    d.text((60, 42), company, font=font(30, True), fill="white")
    d.text((60, 88), address, font=font(18), fill=(200, 208, 220))
    d.text((60, 116), vat, font=font(15), fill=(160, 172, 190))
    d.text((940, 92), title, font=font(38, True), fill="white", anchor="rm")

    for i, (label, value) in enumerate(meta):
        y = 200 + i * 38
        d.text((60, y), label, font=font(17), fill=GRAY)
        d.text((230, y), value, font=font(17, True), fill=BLACK)

    d.text((560, 200), "BILL TO", font=font(17, True), fill=GRAY)
    for i, line in enumerate(bill_to):
        d.text((560, 232 + i * 28), line, font=font(18), fill=BLACK)

    if po_list:
        y0 = 200 + len(meta) * 38 + 20
        d.text((60, y0), "PURCHASE ORDERS COVERED", font=font(15, True), fill=GRAY)
        for i, po in enumerate(po_list):
            d.text((60, y0 + 26 + i * 26), po, font=font(17), fill=BLACK)

    table_top = 540 if po_list else 410
    d.rectangle([60, table_top, 940, table_top + 42], fill=LIGHT)
    d.text((76, table_top + 10), "DESCRIPTION", font=font(15, True), fill=GRAY)
    d.text((560, table_top + 10), "QTY", font=font(15, True), fill=GRAY)
    d.text((680, table_top + 10), "UNIT PRICE", font=font(15, True), fill=GRAY)
    d.text((924, table_top + 10), "AMOUNT", font=font(15, True), fill=GRAY, anchor="ra")

    for i, (desc, qty, unit, amount) in enumerate(items):
        y = table_top + 62 + i * 50
        d.text((76, y), desc, font=font(18), fill=BLACK)
        d.text((560, y), str(qty), font=font(18), fill=BLACK)
        d.text((680, y), unit, font=font(18), fill=BLACK)
        d.text((924, y), amount, font=font(18), fill=BLACK, anchor="ra")
        d.line([60, y + 36, 940, y + 36], fill=(228, 231, 236), width=1)

    total_top = table_top + 80 + len(items) * 50
    d.line([640, total_top, 940, total_top], fill=(200, 205, 212), width=1)
    for i, (label, value) in enumerate(totals):
        y = total_top + 18 + i * 36
        d.text((700, y), label, font=font(17), fill=GRAY)
        d.text((924, y), value, font=font(17), fill=BLACK, anchor="ra")
    y = total_top + 18 + len(totals) * 36 + 12
    d.text((700, y), total_label, font=font(22, True), fill=BLACK)
    d.text((924, y - 4), total, font=font(26, True), fill=BLACK, anchor="ra")

    foot = total_top + 120 + len(totals) * 36
    d.line([60, foot - 20, 940, foot - 20], fill=(228, 231, 236), width=1)
    for i, line in enumerate(footer):
        d.text((60, foot + i * 28), line, font=font(16), fill=GRAY)

    if stamp:
        d.rectangle([660, 1060, 940, 1150], outline=stamp_color, width=4)
        d.text((800, 1105), stamp, font=font(34, True), fill=stamp_color, anchor="mm")

    img.save(path, "PNG")
    print(f"wrote {path}")


ACME = ["Acme Ltd.", "Unit 7, Grand Canal Dock", "Dublin 2, Ireland"]
NORTHWIND = ("NORTHWIND SUPPLY CO.", "42 Harbour Street, Dublin 2, Ireland", "VAT IE 638 2910 W")
LOGISTICS = ("NORTHWIND LOGISTICS", "Harbour Terminal, Dublin Port, Ireland", "VAT IE 638 2911 X")


def invoice_meta(number, date, due, terms, po):
    return [
        ("Invoice No.", number),
        ("Invoice date", date),
        ("Due date", due),
        ("Payment terms", terms),
        ("PO number", po),
    ]


if __name__ == "__main__":
    OUT.mkdir(exist_ok=True)

    draw_doc(
        OUT / "invoice-standard.png",
        title="INVOICE",
        company=NORTHWIND[0],
        address=NORTHWIND[1],
        vat=NORTHWIND[2],
        meta=invoice_meta("INV-2026-0412", "10 Nov 2026", "10 Dec 2026", "Net 30", "PO-2026-118"),
        bill_to=ACME,
        items=[
            ("Standing desk, oak", 2, "$289.00", "$578.00"),
            ("Monitor arm, dual", 3, "$36.50", "$109.50"),
        ],
        totals=[("Subtotal", "$687.50"), ("Tax (8%)", "$55.00")],
        total_label="TOTAL",
        total="$742.50",
        footer=[
            "Payment terms: Net 30. Please quote the invoice number with your payment.",
            "Bank: Harbour Bank · IBAN IE29 HABK 9000 1234 5678 90 · BIC HABKIE2D",
        ],
    )

    draw_doc(
        OUT / "invoice-multi-po.png",
        title="INVOICE",
        company=NORTHWIND[0],
        address=NORTHWIND[1],
        vat=NORTHWIND[2],
        meta=[
            ("Invoice No.", "INV-2026-0455"),
            ("Invoice date", "12 Nov 2026"),
            ("Due date", "12 Dec 2026"),
            ("Payment terms", "Net 30"),
            ("PO number", "see list"),
        ],
        bill_to=ACME,
        po_list=["PO-2026-118 · 2 standing desks", "PO-2026-121 · 3 monitor arms", "PO-2026-127 · 1 desk lamp"],
        items=[
            ("Standing desk, oak", 2, "$289.00", "$578.00"),
            ("Monitor arm, dual", 3, "$36.50", "$109.50"),
            ("Desk lamp, LED", 1, "$64.00", "$64.00"),
        ],
        totals=[("Subtotal", "$751.50"), ("Tax (8%)", "$60.12")],
        total_label="TOTAL",
        total="$811.62",
        footer=[
            "This invoice consolidates three purchase orders into a single bill.",
            "Quote the invoice number when paying. Bank: Harbour Bank · IBAN IE29 HABK 9000 1234 5678 90",
        ],
    )

    draw_doc(
        OUT / "invoice-overdue.png",
        title="INVOICE",
        company=NORTHWIND[0],
        address=NORTHWIND[1],
        vat=NORTHWIND[2],
        meta=invoice_meta("INV-2026-0288", "01 Sep 2026", "16 Sep 2026", "Net 15", "—"),
        bill_to=ACME,
        items=[
            ("Server rack, 42U", 4, "$2,500.00", "$10,000.00"),
            ("UPS unit, 3kVA", 2, "$1,000.00", "$2,000.00"),
        ],
        totals=[("Subtotal", "$12,000.00"), ("Tax (8%)", "$960.00")],
        total_label="TOTAL",
        total="$12,960.00",
        footer=[
            "Payment terms: Net 15. Please quote the invoice number with your payment.",
            "Bank: Harbour Bank · IBAN IE29 HABK 9000 1234 5678 90 · BIC HABKIE2D",
        ],
        stamp="OVERDUE",
        stamp_color=RED,
    )

    draw_doc(
        OUT / "freight-invoice.png",
        title="FREIGHT INVOICE",
        company=LOGISTICS[0],
        address=LOGISTICS[1],
        vat=LOGISTICS[2],
        meta=[
            ("Invoice No.", "FR-2026-0771"),
            ("Invoice date", "14 Nov 2026"),
            ("Due date", "29 Nov 2026"),
            ("Payment terms", "Net 15"),
            ("PO number", "PO-2026-131"),
        ],
        bill_to=ACME,
        items=[
            ("Ocean freight, Dublin–Rotterdam", 1, "$1,850.00", "$1,850.00"),
            ("Terminal handling charge", 1, "$240.00", "$240.00"),
            ("Customs clearance", 1, "$120.00", "$120.00"),
            ("Fuel surcharge", 1, "$95.00", "$95.00"),
        ],
        totals=[("Subtotal", "$2,305.00"), ("Tax (0%)", "$0.00")],
        total_label="TOTAL DUE",
        total="$2,305.00",
        footer=[
            "Shipment: container MSKU 4471 20ft · B/L 2026-DUB-0093 · gross weight 12,400 kg",
            "Freight services invoiced by Northwind Logistics. Bank: Harbour Bank · IBAN IE29 HABK 9000 1234 5678 90",
        ],
    )

    draw_doc(
        OUT / "credit-note.png",
        title="CREDIT NOTE",
        company=NORTHWIND[0],
        address=NORTHWIND[1],
        vat=NORTHWIND[2],
        meta=[
            ("Credit note No.", "CN-2026-0034"),
            ("Credit date", "15 Nov 2026"),
            ("Original invoice", "INV-2026-0412"),
            ("Reason", "Returned goods"),
            ("PO number", "—"),
        ],
        bill_to=ACME,
        items=[("Credit: standing desk, oak (damaged)", 1, "-$289.00", "-$289.00")],
        totals=[("Subtotal", "-$289.00"), ("Tax credit (8%)", "-$23.12")],
        total_label="TOTAL CREDIT",
        total="-$312.12",
        footer=[
            "This credit note reduces the amount owed on invoice INV-2026-0412.",
            "No payment is due on this document. The credit is applied to your account.",
        ],
        stamp="CREDIT",
        stamp_color=GREEN,
    )

    draw_doc(
        OUT / "debit-note.png",
        title="DEBIT NOTE",
        company=NORTHWIND[0],
        address=NORTHWIND[1],
        vat=NORTHWIND[2],
        meta=[
            ("Debit note No.", "DN-2026-0019"),
            ("Debit date", "16 Nov 2026"),
            ("Original invoice", "FR-2026-0771"),
            ("Reason", "Undercharged freight"),
            ("PO number", "PO-2026-131"),
        ],
        bill_to=ACME,
        items=[("Price adjustment: fuel surcharge", 1, "$180.00", "$180.00")],
        totals=[("Subtotal", "$180.00"), ("Tax (0%)", "$0.00")],
        total_label="TOTAL DUE",
        total="$180.00",
        footer=[
            "This debit note adds $180.00 to the amount owed on invoice FR-2026-0771.",
            "Payment is due within 15 days of the debit note date.",
        ],
        stamp="DEBIT",
        stamp_color=AMBER,
    )

    draw_doc(
        OUT / "receipt.png",
        title="PAYMENT RECEIPT",
        company=NORTHWIND[0],
        address=NORTHWIND[1],
        vat=NORTHWIND[2],
        meta=[
            ("Receipt No.", "RCPT-2026-9007"),
            ("Payment date", "18 Nov 2026"),
            ("Invoice paid", "INV-2026-0412"),
            ("Method", "Visa ending 4242"),
            ("Transaction ID", "TXN-8841-2279"),
        ],
        bill_to=ACME,
        items=[("Payment received: invoice INV-2026-0412", 1, "$742.50", "$742.50")],
        totals=[("Subtotal", "$742.50"), ("Tax included (8%)", "$55.00")],
        total_label="AMOUNT PAID",
        total="$742.50",
        footer=[
            "Paid in full. Thank you for your payment.",
            "This is a receipt, not a request for payment. No further amount is due.",
        ],
        stamp="PAID",
        stamp_color=GREEN,
    )

    draw_doc(
        OUT / "statement.png",
        title="ACCOUNT STATEMENT",
        company=NORTHWIND[0],
        address=NORTHWIND[1],
        vat=NORTHWIND[2],
        meta=[
            ("Statement No.", "ST-2026-11"),
            ("Period", "01 Oct – 31 Oct 2026"),
            ("Customer", "Acme Ltd."),
            ("Currency", "USD"),
            ("Page", "1 of 1"),
        ],
        bill_to=ACME,
        items=[
            ("Opening balance", "", "", "$4,120.00"),
            ("Invoice INV-2026-0301", "", "", "$1,240.00"),
            ("Payment received 12 Oct", "", "", "-$1,240.00"),
            ("Invoice INV-2026-0288", "", "", "$12,960.00"),
        ],
        totals=[("Closing balance", "$17,080.00")],
        total_label="TOTAL OUTSTANDING",
        total="$17,080.00",
        footer=[
            "This is a summary of account activity for the period. It is not a request for payment.",
            "Please check the statement and report any discrepancy within 14 days.",
        ],
    )
