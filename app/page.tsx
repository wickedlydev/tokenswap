import { Sparkles, ArrowRight, Zap } from "lucide-react";
import Link from "next/link";

export default function Home() {
  const containerClass = "flex flex-col flex-1 bg-[#0a0a0a] text-white";
  const pillClass = "inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-4 py-1.5 text-sm text-purple-300";
  const btnPurple = "inline-flex items-center gap-2 rounded-full bg-purple-600 px-8 py-3 text-sm font-semibold text-white hover:bg-purple-500 transition-colors";
  const btnOutline = "inline-flex items-center gap-2 rounded-full border border-zinc-700 px-8 py-3 text-sm font-semibold text-white hover:bg-zinc-800 transition-colors";
  const stepCircle = "flex h-8 w-8 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 text-sm font-bold shrink-0";

  return (
    <div className={containerClass}>
      <section className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <div className={`${pillClass} mb-8`}>
          <Sparkles className="h-4 w-4" />
          The marketplace for AI API credits
        </div>
        <h1 className="max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          Buy AI credits. Sell your surplus.{" "}
          <span className="text-purple-500">No subscriptions.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg text-zinc-400">
          Sell your unused API tokens to buyers who need them. Your real API key is never exposed.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link href="/dashboard/sell" className={btnPurple}>Start Selling <ArrowRight className="h-4 w-4" /></Link>
          <Link href="/dashboard/buy" className={btnOutline}>Browse Marketplace</Link>
        </div>
      </section>

      <section className="border-t border-zinc-800 px-4 py-16">
        <div className="mx-auto max-w-4xl grid grid-cols-3 gap-8 text-center">
          <div><div className="text-3xl font-bold text-purple-400">100%</div><div className="mt-1 text-sm text-zinc-400">Secure Proxy</div></div>
          <div><div className="text-3xl font-bold text-purple-400">10%</div><div className="mt-1 text-sm text-zinc-400">Platform Fee</div></div>
          <div><div className="text-3xl font-bold text-purple-400">50%+</div><div className="mt-1 text-sm text-zinc-400">Savings vs Retail</div></div>
        </div>
      </section>

      <section className="border-t border-zinc-800 px-4 py-16">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-3xl font-bold mb-12">How it works</h2>
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-xl font-semibold text-purple-400 mb-6">For Sellers</h3>
              <div className="space-y-6">
                <div className="flex gap-4"><div className={stepCircle}>1</div><div><div className="font-medium">Add your API key</div><div className="text-sm text-zinc-400">Encrypted with AES-256-GCM, never shared</div></div></div>
                <div className="flex gap-4"><div className={stepCircle}>2</div><div><div className="font-medium">Create a listing</div><div className="text-sm text-zinc-400">Set price per million tokens and quantity</div></div></div>
                <div className="flex gap-4"><div className={stepCircle}>3</div><div><div className="font-medium">Earn money</div><div className="text-sm text-zinc-400">Get paid when buyers purchase (10% fee)</div></div></div>
              </div>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-purple-400 mb-6">For Buyers</h3>
              <div className="space-y-6">
                <div className="flex gap-4"><div className={stepCircle}>1</div><div><div className="font-medium">Browse listings</div><div className="text-sm text-zinc-400">Find best prices from top AI providers</div></div></div>
                <div className="flex gap-4"><div className={stepCircle}>2</div><div><div className="font-medium">Purchase tokens</div><div className="text-sm text-zinc-400">Pay via Stripe, get a proxy API key instantly</div></div></div>
                <div className="flex gap-4"><div className={stepCircle}>3</div><div><div className="font-medium">Use like any API key</div><div className="text-sm text-zinc-400">Drop-in compatible with OpenAI SDK</div></div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-800 px-4 py-8 mt-auto">
        <div className="mx-auto max-w-4xl flex items-center justify-between text-sm text-zinc-500">
          <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-purple-500" />TokenSwap</div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-zinc-300">Sign in</Link>
            <Link href="/register" className="hover:text-zinc-300">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}