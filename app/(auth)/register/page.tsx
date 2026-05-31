"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Loader2, Zap } from "lucide-react";

const formSchema = z.object({
  name: z.string().optional(),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type FormValues = z.infer<typeof formSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  async function handleSubmit(values: FormValues) {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name || null,
          email: values.email,
          password: values.password,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Registration failed", { duration: 5000 });
        return;
      }
      await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
      });
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error("Network error. Please try again.", { duration: 5000 });
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder:text-zinc-500 focus:border-purple-500 focus:outline-none";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-8">
          <Zap className="h-8 w-8 text-purple-500" />
          <span className="text-2xl font-bold text-white">TokenSwap</span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <h1 className="text-xl font-semibold text-white mb-6">Create account</h1>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Name (optional)</label>
              <input
                type="text"
                {...form.register("name")}
                className={inputClass}
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Email</label>
              <input
                type="email"
                {...form.register("email")}
                required
                className={inputClass}
                placeholder="you@example.com"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-400 mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm text-zinc-400 mb-1">Password</label>
              <input
                type="password"
                {...form.register("password")}
                required
                minLength={8}
                className={inputClass}
                placeholder="Min. 8 characters"
              />
              {form.formState.errors.password && (
                <p className="text-xs text-red-400 mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>
            <button type="submit" disabled={loading} className="w-full rounded-lg bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors">
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Creating account...
                </span>
              ) : (
                "Create account"
              )}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-zinc-500">
          Already have an account? <Link href="/login" className="text-purple-400 hover:text-purple-300">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
