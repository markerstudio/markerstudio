// Marker Studio® Service Agreement — a reusable template generalised from the
// studio's standard contract. The variable parts (client, representative,
// package, scope, purpose) are prefilled from the accepted proposal / brief.

export type AgreementSection = { n: string; title: string; body?: string[]; list?: string[] };

export type AgreementInput = {
  clientName: string;
  representative: string;
  phone: string;
  packageName: string;
  scope: string[];
  purpose: string;
};

export type Agreement = {
  summary: {
    client: string;
    representative: string;
    provider: string;
    value: string;
    packageConfirmation: string;
    paymentNote: string;
  };
  sections: AgreementSection[];
};

export function buildAgreement(d: AgreementInput): Agreement {
  const scope = d.scope.length
    ? d.scope
    : ["Branding and visual identity", "Launch designs", "Final setup and handover"];

  return {
    summary: {
      client: d.clientName || "—",
      representative: d.representative || "—",
      provider: "Marker Studio®",
      value: "As per the accepted proposal — final figure confirmed with Marker Studio® before work begins.",
      packageConfirmation: d.packageName || scope.join(", "),
      paymentNote:
        "Each scope is paid in two parts — 50% before starting the current scope and 50% after approval of that scope, before moving to the next phase.",
    },
    sections: [
      {
        n: "1",
        title: "Parties",
        body: [
          `This Service Agreement is made between Marker Studio®, a creative branding and marketing studio based in Beit Sahour, Palestine (“Studio”), and ${d.clientName || "the Client"}${d.representative ? `, represented by ${d.representative}` : ""} (“Client”).`,
          "The effective date of this Agreement is the date of signature by both parties, or the date the first phase advance payment is received, whichever occurs first.",
        ],
      },
      {
        n: "2",
        title: "Project Purpose",
        body: [d.purpose || `${d.clientName || "The Client"}'s project will be developed into a clear, distinctive brand and launch collection that communicate its identity and goals.`],
      },
      {
        n: "3",
        title: "Agreed Scope of Work",
        body: ["The agreed package includes the following deliverables:"],
        list: scope,
      },
      {
        n: "4",
        title: "Payment Structure by Scope",
        body: [
          "Payments are not collected as one large project advance. Instead, each phase is activated by an advance for that phase, then completed by the balance payment after approval of that phase.",
          "Each scope is split 50% before the phase starts and 50% after approval of that phase, before moving to the next. A phase starts only after its advance payment is received, and final files for each phase are released after the remaining balance for that phase is paid. All prices are excluding VAT.",
        ],
      },
      {
        n: "5",
        title: "Timeline and Phase Flow",
        body: [
          "An estimated timeline is shared once the first phase advance and all required materials, references, feedback, and content are received. Work proceeds phase by phase through branding, designs, website/digital (if included), then final setup and handover.",
          "Delays in feedback, content, approval, access, or required wording may extend the timeline.",
        ],
      },
      {
        n: "6",
        title: "Languages and Content Approval",
        body: [
          "Where the package includes written or multilingual content, the Client is responsible for reviewing and approving all final language content, including any specialised, legal, or formal terminology, names, and expressions.",
          "If specialised translation or formal review is required, the Client must provide or approve the wording before launch.",
        ],
      },
      {
        n: "7",
        title: "Revision Policy",
        body: [
          "The package includes up to two (2) revision rounds per major deliverable stage (e.g. branding, designs, website structure). Additional revision rounds, major direction changes after approval, or new deliverables outside the agreed scope may be priced separately.",
        ],
      },
      {
        n: "8",
        title: "What Is Not Included",
        body: ["Unless agreed separately in writing, the following are not included in the package:"],
        list: [
          "Manufacturing, embroidery, printing, fabric sourcing, tailoring, or production costs.",
          "Photography, videography, models, product styling, or location rental.",
          "Paid advertising budget, campaign launch execution, or monthly social media management.",
          "Domain registration, hosting, premium plugins/apps, payment gateway fees, or external platform subscriptions.",
          "E-commerce checkout/payment integration, unless agreed separately.",
          "Legal registration, trademark registration, or any third-party approvals.",
          "Additional designs or deliverables beyond the agreed scope.",
        ],
      },
      {
        n: "9",
        title: "Campaign Launch and Marketing",
        body: [
          "Campaign launch plans and monthly marketing management are separate services and are not included unless added by written approval. If selected later, campaign launch support applies to the first month only, while monthly marketing may continue as a separate retainer.",
        ],
      },
      {
        n: "10",
        title: "Client Responsibilities",
        body: [
          "The Client agrees to provide timely feedback, references, brand information, product details, approved content, accuracy guidance, access if needed, and any materials required to complete the project.",
          "The Client also agrees that manufacturing or production should not begin before reviewing and approving the final production-intended files and details.",
        ],
      },
      {
        n: "11",
        title: "Ownership and Usage Rights",
        body: [
          "Final approved deliverables become the Client's property after full payment for the relevant phase is received. Unused concepts, rejected directions, preliminary drafts, internal working files, and presentation methods remain the intellectual property of Marker Studio® unless otherwise agreed in writing.",
          "The Studio may showcase the completed work in its portfolio, website, and social media after public launch, unless the Client requests confidentiality in writing.",
        ],
      },
      {
        n: "12",
        title: "Approval and Handover",
        body: [
          "Each phase is reviewed and approved separately. The final files for each approved phase are handed over after the remaining balance for that phase is paid. Full final project handover is completed after all phases are paid in full.",
        ],
      },
      {
        n: "13",
        title: "Cancellation",
        body: [
          "If the Client cancels the project after a phase has started, payments already made for that phase are non-refundable and will be considered compensation for completed time, planning, and creative work. If the Studio is unable to continue for reasons unrelated to Client delay or non-payment, both parties will agree on a fair settlement based on work completed.",
        ],
      },
    ],
  };
}
