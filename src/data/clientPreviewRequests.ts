import type { ClientRequest } from "../types/template";

/**
 * Static example requests shown when a local LLM isn't reachable, so
 * the AI Clients feature isn't a dead end. Each is clearly marked isPreview
 * and completing one awards a small fixed payout without any AI call.
 */
export const CLIENT_PREVIEW_REQUESTS: ClientRequest[] = [
  {
    id: "preview-priya-northwind",
    clientId: "priya-northwind",
    title: "Vendor Delivery Discrepancy Report",
    description: "\"We got a partial shipment from Fairline Freight again. I need this documented before I call them.\"",
    categoryHint: "procurement-vendor",
    payout: 20,
    deadlineDays: 2,
    isPreview: true,
    createdAt: 0,
    fields: [
      { id: "vendor_name", label: "Vendor Name", type: "text", required: true, placeholder: "Fairline Freight" },
      { id: "po_number", label: "Related PO #", type: "text", required: false },
      { id: "date", label: "Date", type: "date", required: true },
      { id: "discrepancy", label: "Discrepancy Details", type: "textarea", required: true, placeholder: "What was missing or wrong?" },
      { id: "reported_by", label: "Reported By", type: "text", required: true },
    ],
    bodyTemplate:
      "DELIVERY DISCREPANCY REPORT\n\nVendor: {{vendor_name}}\nRelated PO #: {{po_number}}\nDate: {{date}}\n\n--------------------------------------------------------------------\n{{discrepancy}}\n--------------------------------------------------------------------\n\nReported By: {{reported_by}}",
  },
  {
    id: "preview-marcus-brightline",
    clientId: "marcus-brightline",
    title: "Product Launch Press Release",
    description: "\"Big news dropping Friday and we need a press release that actually gets picked up!\"",
    categoryHint: "sales-marketing",
    payout: 35,
    deadlineDays: 3,
    isPreview: true,
    createdAt: 0,
    fields: [
      { id: "headline", label: "Headline", type: "text", required: true },
      { id: "date", label: "Release Date", type: "date", required: true },
      { id: "body", label: "Release Body", type: "textarea", required: true },
      { id: "contact_name", label: "Media Contact", type: "text", required: false },
    ],
    bodyTemplate:
      "PRESS RELEASE\n\n{{headline}}\nFor Release: {{date}}\n\n--------------------------------------------------------------------\n\n{{body}}\n\n--------------------------------------------------------------------\nMedia Contact: {{contact_name}}",
  },
  {
    id: "preview-dana-northstar",
    clientId: "dana-northstar",
    title: "Q1 Financial Statement Summary",
    description: "\"The board meets Monday. I need a clean summary of where we stand — no surprises.\"",
    categoryHint: "finance-accounting",
    payout: 40,
    deadlineDays: 4,
    isPreview: true,
    createdAt: 0,
    fields: [
      { id: "author", label: "Prepared By", type: "text", required: true },
      { id: "date", label: "Date", type: "date", required: true },
      { id: "period", label: "Period Covered", type: "text", required: false, placeholder: "Q1 2026" },
      { id: "summary", label: "Summary", type: "textarea", required: true },
    ],
    bodyTemplate:
      "FINANCIAL STATEMENT SUMMARY\n\nPrepared by: {{author}}                    Date: {{date}}\nPeriod Covered: {{period}}\n\n--------------------------------------------------------------------\n\n{{summary}}",
  },
  {
    id: "preview-tomas-vertex",
    clientId: "tomas-vertex",
    title: "Scheduled Maintenance Outage Notice",
    description: "\"Patching the auth servers Saturday night. Draft the outage notice.\"",
    categoryHint: "it-technical",
    payout: 18,
    deadlineDays: 1,
    isPreview: true,
    createdAt: 0,
    fields: [
      { id: "date", label: "Date", type: "date", required: true },
      { id: "system_affected", label: "System Affected", type: "text", required: true },
      { id: "expected_resolution", label: "Expected Resolution", type: "text", required: false },
      { id: "body", label: "Details", type: "textarea", required: true },
      { id: "issued_by", label: "Issued By", type: "text", required: false },
    ],
    bodyTemplate:
      "NOTICE\n\nSYSTEM OUTAGE NOTICE\nDate: {{date}}\nSystem Affected: {{system_affected}}\nExpected Resolution: {{expected_resolution}}\n\n--------------------------------------------------------------------\n\n{{body}}\n\n--------------------------------------------------------------------\nIssued by: {{issued_by}}",
  },
  {
    id: "preview-grace-harborview",
    clientId: "grace-harborview",
    title: "New Hire Onboarding Checklist",
    description: "\"We've got someone starting Monday and I want their first week to feel put-together.\"",
    categoryHint: "human-resources",
    payout: 22,
    deadlineDays: 3,
    isPreview: true,
    createdAt: 0,
    fields: [
      { id: "new_hire_name", label: "New Hire Name", type: "text", required: true },
      { id: "start_date", label: "Start Date", type: "date", required: true },
      { id: "owner", label: "Onboarding Owner", type: "text", required: false },
      { id: "items", label: "Checklist Items", type: "textarea", required: true },
    ],
    bodyTemplate:
      "ONBOARDING CHECKLIST\nNew Hire Name: {{new_hire_name}}        Start Date: {{start_date}}\nOwner: {{owner}}\n\n--------------------------------------------------------------------\n\n{{items}}",
  },
  {
    id: "preview-sofia-clearpath",
    clientId: "sofia-clearpath",
    title: "Weekly Project Status Report",
    description: "\"Client call is at 4. Need the status report before then, on-track or not.\"",
    categoryHint: "project-management",
    payout: 20,
    deadlineDays: 1,
    isPreview: true,
    createdAt: 0,
    fields: [
      { id: "author", label: "Prepared By", type: "text", required: true },
      { id: "date", label: "Date", type: "date", required: true },
      { id: "overall_status", label: "Overall Status", type: "select", required: true, options: ["On Track", "At Risk", "Delayed", "Completed"] },
      { id: "summary", label: "Summary", type: "textarea", required: true },
    ],
    bodyTemplate:
      "PROJECT STATUS REPORT\n\nPrepared by: {{author}}                    Date: {{date}}\nOverall Status: {{overall_status}}\n\n--------------------------------------------------------------------\n\n{{summary}}",
  },
  {
    id: "preview-kevin-summit",
    clientId: "kevin-summit",
    title: "Customer Complaint Response",
    description: "\"A customer's third email today about their late order. Let's make this one land right.\"",
    categoryHint: "customer-service",
    payout: 15,
    deadlineDays: 1,
    isPreview: true,
    createdAt: 0,
    fields: [
      { id: "sender_name", label: "Your Name", type: "text", required: true },
      { id: "date", label: "Date", type: "date", required: true },
      { id: "recipient_name", label: "Customer Name", type: "text", required: true },
      { id: "complaint_summary", label: "Complaint Summary", type: "textarea", required: false },
      { id: "details", label: "Message", type: "textarea", required: true },
      { id: "signature", label: "Signature", type: "signature", required: true },
    ],
    bodyTemplate:
      "{{date}}\n\n{{recipient_name}}\n\nDear {{recipient_name}},\n\nRegarding: {{complaint_summary}}\n\n{{details}}\n\nSincerely,\n\n{{signature}}\n{{sender_name}}",
  },
  {
    id: "preview-anika-fieldworks",
    clientId: "anika-fieldworks",
    title: "Request for Quotation — Packaging Supplies",
    description: "\"Need pricing from three suppliers by Friday. Draft the RFQ.\"",
    categoryHint: "procurement-vendor",
    payout: 18,
    deadlineDays: 2,
    isPreview: true,
    createdAt: 0,
    fields: [
      { id: "counterparty", label: "Vendor", type: "textarea", required: true },
      { id: "date", label: "Date", type: "date", required: true },
      { id: "response_deadline", label: "Response Deadline", type: "date", required: false },
      { id: "line_items", label: "Line Items", type: "textarea", required: true },
      { id: "total", label: "Estimated Value", type: "currency", required: true },
    ],
    bodyTemplate:
      "REQUEST FOR QUOTATION\n\nVendor:\n{{counterparty}}\n\nDate: {{date}}                          Response Deadline: {{response_deadline}}\n\n--------------------------------------------------------------------\n{{line_items}}\n--------------------------------------------------------------------\n\nESTIMATED VALUE: {{total}}",
  },
];

export function getPreviewRequestForClient(clientId: string): ClientRequest | undefined {
  return CLIENT_PREVIEW_REQUESTS.find((r) => r.clientId === clientId);
}
