// Demo inputs. Edit freely — the UI reads this file on load.
const EXAMPLES = {
  email: [
    {
      label: "Ceiling leak",
      text: `From: Priya Nair <priya.nair@example.com>
Subject: Water coming through the kitchen ceiling — Flat 4B

Hi,

Water started dripping through the kitchen ceiling about an hour ago, right next to the light fitting. I think it is coming from the flat above (5B) but nobody is answering the door. I have put buckets down and switched off the kitchen lights at the fuse box.

Please send someone as soon as possible — the ceiling plaster is starting to bulge.

Priya Nair
Flat 4B, Riverside Court`,
    },
    {
      label: "Noise complaint",
      text: `From: Daniel Okafor <d.okafor@example.com>
Subject: Loud music from Flat 2C again

Hello,

This is the third weekend in a row that Flat 2C has played loud music past 1 a.m. I have spoken to them twice and nothing has changed. I work early shifts and it is affecting my sleep.

Could you remind them of the building quiet hours, or tell me what the next step is?

Thanks,
Daniel Okafor
Flat 3C`,
    },
    {
      label: "Lease renewal",
      text: `From: Marta Silva <marta.silva@example.com>
Subject: Renewing our lease for another year

Hi,

Our lease on Flat 1A ends on 31 January. We would like to renew for another 12 months. Could you let me know what the process is, and whether we need to sign anything before the end of December?

We would also like to ask whether we can keep a small cat — happy to follow any pet policy.

Best regards,
Marta Silva`,
    },
    {
      label: "Dripping tap",
      text: `From: Tom Becker <tom.becker@example.com>
Subject: Bathroom tap dripping

Hi,

The cold tap in our bathroom sink has been dripping for about a week, even when fully closed. It is not urgent, but it is getting worse. Any day next week works for a plumber — I work from home on Tuesdays and Thursdays.

Thanks,
Tom
Flat 6D`,
    },
  ],

  support: [
    {
      label: "Clicked phishing link",
      text: `I think I clicked on a fake Microsoft link in an email about a shared invoice about 20 minutes ago. It asked for my password and I typed it in before I noticed the address looked wrong. Now I am getting MFA prompts on my phone that I did not request. What should I do? I have not approved any of them.`,
    },
    {
      label: "VPN down for office",
      text: `Nobody in the Pune office can connect to the VPN since 9:30 this morning. It just says "connection timed out". About 40 of us are affected and we cannot reach the ERP or the shared drives. Clients are waiting on reports due at noon.`,
    },
    {
      label: "Laptop won't boot",
      text: `My laptop shows a black screen with a blinking cursor after the logo and does not get to Windows. I tried restarting three times. I have a backup laptop at home but my presentation for tomorrow is on this one, and I am not sure it was synced to OneDrive.`,
    },
    {
      label: "New joiner setup",
      text: `We have a new analyst, Anika Rao, starting on Monday 1 December in the Finance team. She will need a laptop, an email account, access to the Finance shared folder and a Power BI licence. Her manager is Rahul Menon.`,
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
