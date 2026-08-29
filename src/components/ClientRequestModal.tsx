import { useState } from "react";
import type { ClientPersona } from "../data/clients";
import type { ClientRequest } from "../types/template";
import { NegotiationChat } from "./NegotiationChat";
import type { NegotiationOffer } from "../lib/aiClient";

interface ClientRequestModalProps {
  clientPersona: ClientPersona;
  request: ClientRequest;
  hasApiKey: boolean;
  apiKey: string;
  onClose: () => void;
  onDecline: () => void;
  onComplete: (finalRequest: ClientRequest) => void;
  onUpdateRequest: (request: ClientRequest) => void;
}

export function ClientRequestModal({
  clientPersona,
  request,
  hasApiKey,
  apiKey,
  onClose,
  onDecline,
  onComplete,
  onUpdateRequest,
}: ClientRequestModalProps) {
  const [showChat, setShowChat] = useState(false);

  function handleAcceptOffer(offer: NegotiationOffer) {
    onUpdateRequest({ ...request, payout: offer.payout, deadlineDays: offer.deadlineDays });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span className="text-3xl">{clientPersona.avatar}</span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-stone-400">
              {clientPersona.name} · {clientPersona.company}
            </p>
            <h2 className="text-lg font-semibold text-stone-900">{request.title}</h2>
          </div>
          {request.isPreview && (
            <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
              Preview
            </span>
          )}
        </div>

        <p className="mt-3 text-sm italic leading-relaxed text-stone-600">{request.description}</p>

        <div className="mt-4 flex items-center gap-4 rounded-lg bg-stone-50 p-3 text-sm text-stone-600">
          <span>💵 ${request.payout}</span>
          <span>·</span>
          <span>⏱ due in {request.deadlineDays}d</span>
          <span>·</span>
          <span>{request.fields.length} fields</span>
        </div>

        {request.isPreview && (
          <p className="mt-2 text-xs text-stone-400">
            This is a static preview request. Add a Groq API key in Settings to unlock
            live, dynamic requests and negotiation chat.
          </p>
        )}

        {!request.isPreview && hasApiKey && (
          <div className="mt-4">
            {showChat ? (
              <NegotiationChat
                clientPersona={clientPersona}
                request={request}
                apiKey={apiKey}
                onAcceptOffer={handleAcceptOffer}
              />
            ) : (
              <button
                type="button"
                onClick={() => setShowChat(true)}
                className="text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                💬 Chat with {clientPersona.name}
              </button>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-between gap-2">
          <button
            type="button"
            onClick={onDecline}
            className="rounded-md px-4 py-2 text-sm font-medium text-stone-500 hover:bg-stone-100"
          >
            Decline
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => onComplete(request)}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800"
            >
              Complete (+${request.payout})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
