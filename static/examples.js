// Demo inputs. Edit freely — the UI reads this file on load.
const EXAMPLES = {
  email: [
    {
      label: "Refund complaint",
      text: `From: Priya Nair <priya.nair@northwind-retail.com>
Subject: Charged twice for March — refund needed today

Hi team,

We were billed twice for March on invoice #4411 (INV-2026-0312). The duplicate charge is $2,480 and it has already cleared our card. I flagged this with your support line yesterday and got no reply.

Please refund the duplicate today. If this is not resolved by Friday we will move our subscription to another vendor.

Priya Nair
Finance Manager, Northwind Retail`,
    },
    {
      label: "Pricing enquiry",
      text: `From: Daniel Okafor <d.okafor@brightpath.io>
Subject: Pricing for 50 seats + SSO

Hello,

We are evaluating tools for our operations team (about 50 people) and need SSO and audit logs. Could you send pricing for the business tier, and let me know whether onboarding is included?

We would also like a short demo next week if possible.

Best,
Daniel Okafor
Head of Operations, Brightpath`,
    },
    {
      label: "Production outage",
      text: `From: ops@finch-payments.com
Subject: URGENT — API returning 503 since 09:14 UTC

Our checkout has been down for 40 minutes. Every call to your /v2/charges endpoint returns 503, and our error rate is 100%. We are losing roughly $8,000 per hour and our status page is already red.

We need an engineer on this immediately. Incident channel: #finch-laya-outage.

Ops on-call, Finch Payments`,
    },
    {
      label: "GDPR question",
      text: `From: Marta Silva <marta.silva@lumen-legal.eu>
Subject: Data retention question

Hi,

Could you point me to your current data retention policy? Specifically, how long do you keep support attachments after an account is closed, and do you delete backups on the same schedule?

No urgency — we are updating our vendor register.

Thanks,
Marta`,
    },
  ],

  support: [
    {
      label: "Double charge, no order",
      text: `My payment was deducted twice, but my order was never placed. The money left my account on Monday and I still have no confirmation email. I need this fixed today — I have already been charged $89.99 twice.`,
    },
    {
      label: "Damaged delivery",
      text: `The blender arrived with a cracked jug and the box was crushed on one side. I ordered it for my mother's birthday this weekend. I want a replacement, not a refund, and I need it before Saturday.`,
    },
    {
      label: "Account locked",
      text: `I am locked out of my account and the reset email never arrives. I have a client presentation in two hours and all my slides are in your cloud drive. Please unlock it or tell me another way in. I have tried three times.`,
    },
  ],

  meeting: [
    {
      label: "Launch sync",
      text: `Product launch sync — Tuesday 10:00
Attendees: Sarah, Miguel, Priya, Tom

We agreed to move the launch from April 12 to April 26 to finish the payment flow. Sarah will update the release calendar by Wednesday. Miguel is going to finish the pricing page copy before Friday. We decided to drop the referral feature from v1 and revisit it in Q3. Priya will send the beta invite list to marketing by end of week. Tom raised the App Store review risk; we agreed to submit the build on April 18. Next sync is Monday at 10:00.`,
    },
    {
      label: "Client kickoff",
      text: `Client kickoff — Horizon Bank
Present: Elena (client), James, Aisha

Elena confirmed the pilot starts with 200 users in the Dublin branch. James will prepare the data migration plan by March 14. We agreed the integration will use the existing SSO provider rather than building a new one. Aisha needs the client's security questionnaire returned before the pilot can start; Elena will chase their IT team this week. Budget approval is still open — Elena will confirm by next Tuesday. We decided to schedule a technical deep dive for the week of March 9.`,
    },
  ],

  contract: [
    {
      label: "Mutual NDA",
      text: `MUTUAL NON-DISCLOSURE AGREEMENT

1. Term. This Agreement commences on the Effective Date and continues for two (2) years. Thereafter it shall automatically renew for successive one-year periods unless either party gives written notice of non-renewal at least sixty (60) days before the end of the then-current term.

2. Confidentiality. Each party shall keep the other party's Confidential Information confidential and shall not disclose it to any third party without prior written consent. The obligations in this section survive termination of this Agreement for a period of five (5) years.

3. Governing Law. This Agreement is governed by the laws of the State of Delaware.

4. Assignment. Neither party may assign this Agreement without the prior written consent of the other party.`,
    },
    {
      label: "Services MSA",
      text: `MASTER SERVICES AGREEMENT

5. Limitation of Liability. EXCEPT FOR THE EXCLUSIONS BELOW, EACH PARTY'S TOTAL LIABILITY UNDER THIS AGREEMENT SHALL BE UNLIMITED. The Supplier shall indemnify the Customer against any and all losses, claims and damages arising from the Services, including indirect and consequential loss.

6. Term and Termination. The Customer may terminate this Agreement at any time for convenience on thirty (30) days' notice. The Supplier may terminate only for material breach that remains uncured after ninety (90) days.

7. Fees. Invoices are payable within ninety (90) days of receipt.

8. Governing Law. This Agreement shall be governed by the laws of the Cayman Islands.

9. Data Protection. The Supplier shall process Personal Data only in accordance with the Customer's written instructions and shall implement appropriate technical and organisational measures to protect it.`,
    },
    {
      label: "Office lease",
      text: `OFFICE LEASE AGREEMENT

2. Term. The lease runs for thirty-six (36) months from 1 June 2026, with an option to renew for a further twelve (12) months on the same terms.

4. Assignment and Subletting. The Tenant may not assign, sublet or share the Premises with any third party without the Landlord's prior written consent, which the Landlord may withhold in its absolute discretion. An assignment to an affiliate or to a successor in a merger shall not require the Landlord's consent.

9. Governing Law. This Lease is governed by the laws of the State of New York.

11. Exclusivity. The Landlord shall not lease any other unit in the building to a competing coffee retailer for the duration of the Term.`,
    },
  ],

  vision: [
    {
      label: "Standard invoice",
      src: "/samples/invoice-standard.png",
      text: `NORTHWIND SUPPLY CO. 42 Harbour Street, Dublin 2, Ireland VAT IE 638 2910 W Invoice No. Invoice date Due date Payment terms PO number DESCRIPTION Standing desk, oak Monitor arm, dual 'NV-2026-0412 10 Nov 2026 10 Dec 2026 Net 30 PO-2026-118 BILL TO Acme Ltd. Unit 7, Grand Canal Dock Dublin 2, Ireland QTY 2 3 UNIT PRICE $289.00 $36.50 Subtotal Tax (8%) TOTAL INVOICE AMOUNT $578.00 $109.50 $687.50 $55.00 $742.50 Payment terms: Net 30. Please quote the invoice number with your payment Bank: Harbour Bank IBAN IE29 HABK 9000 1234 5678 90 BIC HABKlE2D`,
    },
    { label: "Multi-PO invoice", src: "/samples/invoice-multi-po.png" },
    { label: "Freight invoice", src: "/samples/freight-invoice.png" },
    { label: "Credit note", src: "/samples/credit-note.png" },
    { label: "Debit note", src: "/samples/debit-note.png" },
    { label: "Receipt", src: "/samples/receipt.png" },
    { label: "Overdue invoice", src: "/samples/invoice-overdue.png" },
    { label: "Statement", src: "/samples/statement.png" },
  ],
};
