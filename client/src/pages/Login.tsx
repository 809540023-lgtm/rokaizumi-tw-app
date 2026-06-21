import { useState } from "react";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export default function Login() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/" + mode, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "發生錯誤，請稍後再試");
        setLoading(false);
        return;
      }
      // 成功：重新載入讓 session 生效
      window.location.href = "/";
    } catch {
      setError("網路錯誤，請稍後再試");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FEF9F3] flex flex-col">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
          <h1 className="text-2xl font-bold text-center mb-1">
            {mode === "login" ? "會員登入" : "註冊新帳號"}
          </h1>
          <p className="text-center text-gray-500 text-sm mb-6">
            登入後即可加入購物車並完成結帳
          </p>

          <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode("login"); setError(""); }}
              className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${
                mode === "login" ? "bg-white shadow text-[#0ABAB5]" : "text-gray-500"
              }`}
            >
              登入
            </button>
            <button
              type="button"
              onClick={() => { setMode("register"); setError(""); }}
              className={`flex-1 py-2 rounded-md text-sm font-bold transition-colors ${
                mode === "register" ? "bg-white shadow text-[#0ABAB5]" : "text-gray-500"
              }`}
            >
              註冊
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="block text-sm font-medium mb-1">姓名（選填）</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0ABAB5]"
                  placeholder="您的稱呼"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0ABAB5]"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">密碼</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0ABAB5]"
                placeholder={mode === "register" ? "至少 6 個字" : "請輸入密碼"}
              />
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg bg-[#0ABAB5] text-white font-bold text-sm disabled:opacity-60"
            >
              {loading ? "處理中..." : mode === "login" ? "登入" : "註冊並登入"}
            </button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
