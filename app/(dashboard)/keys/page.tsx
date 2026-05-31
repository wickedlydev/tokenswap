"use client";

import { useState, useEffect } from "react";
import { Eye, EyeOff, Copy, Check, Key, ExternalLink } from "lucide-react";

interface Purchase {
  id: string; proxyKey: string; tokensPurchased: number; tokensRemaining: number;
  totalPaidCents: number; status: string; createdAt: string;
  listing: { provider: string; model: string };
  usageLogs: Array<{ promptTokens: number; completionTokens: number; model: string; createdAt: string }>;
}

export default function KeysPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/purchases")
      .then((r) => r.json())
      .then((data) => { setPurchases(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  }

  if (loading) return <p className="text-zinc-400">Loading...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">My Proxy Keys</h1>
        <p className="text-zinc-500 mt-1">View and manage your purchased proxy API keys</p>
      </div>

      {purchases.length === 0 && (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center">
          <Key className="mx-auto h-12 w-12 text-zinc-300" />
          <h3 className="mt-4 text-lg font-semibold text-zinc-900">No purchases yet</h3>
          <p className="mt-2 text-sm text-zinc-500">Browse the marketplace to buy tokens.</p>
        </div>
      )}

      <div className="space-y-4">
        {purchases.map((p) => {
          const used = p.tokensPurchased - p.tokensRemaining;
          const pct = p.tokensPurchased > 0 ? (used / p.tokensPurchased) * 100 : 0;
          const barColor = p.status === "depleted" ? "bg-red-500" : pct > 50 ? "bg-green-500" : pct > 10 ? "bg-amber-500" : "bg-red-500";

          return (
            <div key={p.id} className="rounded-xl border border-zinc-200 bg-white p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700">{p.listing.provider}</span>
                    <span className="text-sm text-zinc-600">{p.listing.model}</span>
                  </div>
                  <span className={`inline-flex mt-2 rounded-full px-2 py-0.5 text-xs font-medium ${p.status === "active" ? "bg-green-100 text-green-700" : p.status === "depleted" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>{p.status}</span>
                </div>
                <div className="text-right text-sm text-zinc-500">
                  <div>Purchased: {new Date(p.createdAt).toLocaleDateString()}</div>
                  <div>${(p.totalPaidCents / 100).toFixed(2)}</div>
                </div>
              </div>

              {/* Proxy Key */}
              <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-3 mb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-zinc-400" />
                    <code className="font-mono text-sm text-zinc-900">
                      {revealedKeys[p.id] ? `ts_${p.proxyKey}` : "ts_" + "*".repeat(p.proxyKey.length - 4)}
                    </code>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setRevealedKeys({ ...revealedKeys, [p.id]: !revealedKeys[p.id] })} className="p-1 text-zinc-400 hover:text-zinc-600">
                      {revealedKeys[p.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    <button onClick={() => copyToClipboard(`ts_${p.proxyKey}`)} className="p-1 text-zinc-400 hover:text-zinc-600">
                      {copiedKey === `ts_${p.proxyKey}` ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Usage Bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-zinc-600">{used.toLocaleString()} used</span>
                  <span className="text-zinc-600">{p.tokensRemaining.toLocaleString()} remaining</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-100">
                  <div className={`h-2 rounded-full ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
                <div className="text-xs text-zinc-400 mt-1">Total: {p.tokensPurchased.toLocaleString()} tokens</div>
              </div>

              {/* Integration Snippet */}
              {p.status === "active" && (
                <div className="rounded-lg bg-zinc-900 p-4 mb-4">
                  <p className="text-xs text-zinc-400 mb-2">Integration snippet (OpenAI SDK)</p>
                  <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">{`import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "${window.location.origin}/api/v1",
  apiKey: "ts_${p.proxyKey}",
});`}</pre>
                </div>
              )}

              {/* Usage History */}
              {p.usageLogs.length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-zinc-500 hover:text-zinc-700">Usage history ({p.usageLogs.length} calls)</summary>
                  <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
                    {p.usageLogs.map((log, i) => (
                      <div key={i} className="flex items-center justify-between text-xs text-zinc-500 py-1 border-b border-zinc-100">
                        <span>{new Date(log.createdAt).toLocaleString()}</span>
                        <span>{log.promptTokens + log.completionTokens} tokens</span>
                        <span className="text-zinc-400">{log.model}</span>
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
