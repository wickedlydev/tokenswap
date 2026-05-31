"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TrendingUp, Coins } from "lucide-react";

interface Listing {
  id: string; sellerName: string; provider: string; model: string;
  tokensRemaining: number; pricePerMillionTokens: number; status: string;
}

export default function BuyPage() {
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [sort, setSort] = useState("price_asc");
  const [buyTokens, setBuyTokens] = useState<Record<string, number>>({});
  const [showBuy, setShowBuy] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams();
    if (provider) params.set("provider", provider);
    if (model) params.set("model", model);
    if (sort) params.set("sort", sort);

    setLoading(true);
    fetch(`/api/listings?${params}`)
      .then((r) => r.json())
      .then((data) => { setListings(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [provider, model, sort]);

  async function handleCheckout(listingId: string) {
    const tokenAmount = buyTokens[listingId] || 100000;
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, tokenAmount }),
    });
    if (res.ok) {
      const { url } = await res.json();
      window.location.href = url;
    }
  }

  const pct = (l: Listing) => l.tokensRemaining / (l.tokensRemaining + 0); // simplified

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Buy API Credits</h1>
        <p className="text-zinc-500 mt-1">Browse marketplace listings and save up to 50%+ vs retail</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={provider} onChange={(e) => setProvider(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
          <option value="">All Providers</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
          <option value="groq">Groq</option>
        </select>
        <select value={model} onChange={(e) => setModel(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
          <option value="">All Models</option>
          <option value="gpt-4o">GPT-4o</option>
          <option value="gpt-4o-mini">GPT-4o Mini</option>
          <option value="claude-3-5-sonnet">Claude 3.5 Sonnet</option>
          <option value="claude-3-5-haiku">Claude 3.5 Haiku</option>
          <option value="llama-3.1-70b">Llama 3.1 70B</option>
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg border border-zinc-300 px-3 py-2 text-sm">
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      {/* Listings Grid */}
      {loading && <p className="text-sm text-zinc-400">Loading listings...</p>}
      {!loading && listings.length === 0 && <p className="text-sm text-zinc-400">No listings found.</p>}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {listings.map((l) => {
          const remainingPct = l.tokensRemaining > 0 ? (l.tokensRemaining / Math.max(l.tokensRemaining, 1)) * 100 : 0;
          const isLow = remainingPct < 10 && remainingPct > 0;
          return (
            <div key={l.id} className="rounded-xl border border-zinc-200 bg-white p-5 hover:border-purple-300 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="inline-flex items-center rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">{l.provider}</span>
                <span className="text-xs text-zinc-400">{l.model}</span>
              </div>
              <div className="mb-3">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-zinc-900">${(l.pricePerMillionTokens / 100).toFixed(2)}</span>
                  <span className="text-sm text-zinc-500">/1M tokens</span>
                </div>
              </div>
              <div className="mb-4">
                <div className="flex items-center gap-2 text-sm text-zinc-600">
                  <Coins className="h-4 w-4" />
                  <span>{l.tokensRemaining?.toLocaleString()} tokens available</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-zinc-100">
                  <div className={`h-2 rounded-full ${remainingPct > 50 ? "bg-green-500" : remainingPct > 10 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(100, Math.max(0, remainingPct))}%` }} />
                </div>
              </div>
              {isLow && <div className="mb-3 inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Almost gone!</div>}
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">by {l.sellerName || "anonymous"}</span>
                {showBuy === l.id ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1000}
                      max={l.tokensRemaining}
                      step={1000}
                      value={buyTokens[l.id] || 100000}
                      onChange={(e) => setBuyTokens({ ...buyTokens, [l.id]: Number(e.target.value) })}
                      className="w-24 rounded border border-zinc-300 px-2 py-1 text-sm"
                    />
                    <button onClick={() => handleCheckout(l.id)} className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-500">Buy</button>
                  </div>
                ) : (
                  <button onClick={() => setShowBuy(l.id)} className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-medium text-white hover:bg-purple-500">Buy tokens</button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
