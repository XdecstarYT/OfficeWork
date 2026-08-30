import { renderBody } from "../lib/renderTemplate";

interface DocumentPreviewProps {
  title: string;
  bodyTemplate: string;
  values: Record<string, string>;
}

export function DocumentPreview({ title, bodyTemplate, values }: DocumentPreviewProps) {
  const rendered = renderBody(bodyTemplate, values);

  return (
    <div className="flex justify-center bg-stone-100 p-4">
      <div className="w-full max-w-lg rounded-sm border border-stone-200 bg-white p-6 shadow-sm">
        <p className="mb-3 text-center text-[10px] font-medium uppercase tracking-widest text-stone-400">
          {title}
        </p>
        <div
          className="whitespace-pre-wrap text-[11.5px] leading-relaxed text-stone-800"
          style={{ fontFamily: "ui-monospace, 'Courier New', Courier, monospace" }}
        >
          {rendered}
        </div>
      </div>
    </div>
  );
}
