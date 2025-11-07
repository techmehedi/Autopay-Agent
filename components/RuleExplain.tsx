'use client';

export interface ExplanationItem {
  id: string;
  label?: string;
  reason: string;
  weight?: number;
}

interface RuleExplainProps {
  explanations?: ExplanationItem[];
  reasonFallback?: string;
  confidence?: number;
  traceId?: string;
}

export default function RuleExplain({ explanations, reasonFallback, confidence, traceId }: RuleExplainProps) {
  const hasExplanations = (explanations?.length || 0) > 0;
  return (
    <div className="space-y-2">
      {typeof confidence === 'number' && (
        <div className="text-sm">Confidence: {(confidence * 100).toFixed(0)}%</div>
      )}
      {traceId && (
        <div className="text-sm">
          Trace ID: <span className="font-mono">{traceId}</span>
        </div>
      )}
      <div className="text-sm text-slate-400">Explanations</div>
      {hasExplanations ? (
        <ul className="list-disc space-y-1 pl-5">
          {explanations!.map((e, idx) => (
            <li key={e.id || idx} className="text-sm">
              <span className="font-medium">{e.label || e.id}:</span> {e.reason}
              {typeof e.weight === 'number' && (
                <span className="ml-2 text-slate-400">(weight {e.weight.toFixed(2)})</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-sm">{reasonFallback || 'No explanations available.'}</div>
      )}
    </div>
  );
}


