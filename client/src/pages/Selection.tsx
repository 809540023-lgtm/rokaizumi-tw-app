import { useRef, useState } from "react";
import { trpc } from "../lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { toast } from "sonner";
import { Upload, Sparkles, X, Loader2 } from "lucide-react";

// 將圖片縮到最長邊 900px 的 JPEG data URL，避免資料量過大
function resizeImage(file: File, maxSide = 900): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSide || height > maxSide) {
          if (width >= height) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          } else {
            width = Math.round((width * maxSide) / height);
            height = maxSide;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("canvas"));
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = reject;
      img.src = String(reader.result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Selection() {
  const { user } = useAuth() as any;
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: categories = [] } = trpc.categories.list.useQuery();

  const [images, setImages] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceTWD, setPriceTWD] = useState("");
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [stock, setStock] = useState("50");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiNote, setAiNote] = useState("");

  const createMut = trpc.products.create.useMutation({
    onSuccess: () => {
      toast.success("商品已上架！");
      setImages([]);
      setName("");
      setDescription("");
      setPriceTWD("");
      setCategoryId("");
      setStock("50");
      setAiNote("");
    },
    onError: (e: any) =>
      toast.error(e?.message?.includes("permission") || e?.message?.includes("admin")
        ? "上架需要管理員權限，請先開通你的帳號為管理員。"
        : e?.message || "上架失敗"),
  });

  async function handleFiles(files: FileList | null) {
    if (!files) return;
    const arr: string[] = [];
    for (const f of Array.from(files).slice(0, 8)) {
      try {
        arr.push(await resizeImage(f));
      } catch {
        /* skip */
      }
    }
    setImages((prev) => [...prev, ...arr].slice(0, 8));
  }

  async function runAI() {
    if (!images.length) {
      toast.error("請先上傳至少一張商品圖片");
      return;
    }
    setAiLoading(true);
    setAiNote("");
    try {
      const res = await fetch("/api/ai/product-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: images[0] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) {
        setAiNote(data.error || "AI 無法辨識，請手動填寫。");
        setAiLoading(false);
        return;
      }
      const d = data.draft;
      if (d.name) setName(d.name);
      const feat =
        Array.isArray(d.features) && d.features.length
          ? "\n\n【商品特色】\n" + d.features.map((f: string) => "・" + f).join("\n")
          : "";
      setDescription((d.description || "") + feat);
      if (d.suggestedCategory) {
        const match = (categories as any[]).find((c) =>
          (c.name || "").includes(d.suggestedCategory) || (d.suggestedCategory || "").includes(c.name)
        );
        if (match) setCategoryId(match.id);
      }
      setAiNote("AI 已產生草稿，請確認與編輯後再上架。");
    } catch {
      setAiNote("連線失敗，請手動填寫。");
    }
    setAiLoading(false);
  }

  function submit() {
    if (!name.trim()) return toast.error("請輸入商品名稱");
    if (!priceTWD) return toast.error("請輸入售價");
    if (categoryId === "") return toast.error("請選擇分類");
    createMut.mutate({
      name: name.trim(),
      description: description.trim(),
      price: Number(priceTWD),
      categoryId: Number(categoryId),
      imageUrl: images[0] || "",
      images,
      status: "available",
      specifications: "",
    } as any);
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#FEF9F3] flex flex-col">
        <SiteHeader />
        <main className="flex-1 container mx-auto px-4 py-20 text-center">
          <p className="text-gray-600">請先登入後使用選品上架。</p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FEF9F3] flex flex-col">
      <SiteHeader />
      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl w-full">
        <h1 className="text-2xl font-bold mb-1">選品上架</h1>
        <p className="text-sm text-gray-500 mb-6">
          上傳商品照片或截圖 → AI 自動帶出草稿 → 編輯後一鍵上架。
        </p>

        {/* 圖片上傳 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5">
          <div className="flex flex-wrap gap-3">
            {images.map((src, i) => (
              <div key={i} className="relative w-20 h-20">
                <img src={src} alt="" className="w-20 h-20 object-cover rounded-lg border border-gray-200" />
                <button
                  onClick={() => setImages((p) => p.filter((_, idx) => idx !== i))}
                  className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-gray-700 text-white flex items-center justify-center"
                >
                  <X className="w-3 h-3" />
                </button>
                {i === 0 && (
                  <span className="absolute bottom-0 left-0 text-[10px] bg-[#0ABAB5] text-white px-1 rounded-tr">主圖</span>
                )}
              </div>
            ))}
            <button
              onClick={() => fileRef.current?.click()}
              className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-[#0ABAB5]"
            >
              <Upload className="w-5 h-5" />
              <span className="text-[10px] mt-1">上傳</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>
          <button
            onClick={runAI}
            disabled={aiLoading || !images.length}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E26D5C] text-white font-bold text-sm disabled:opacity-60"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            AI 辨識並產生草稿
          </button>
          {aiNote && <div className="text-xs text-gray-500 mt-2">{aiNote}</div>}
        </div>

        {/* 編輯欄位 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mt-4 space-y-4">
          <div>
            <label className="block text-sm font-bold mb-1">商品名稱</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-sm font-bold mb-1">商品說明</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={6} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-bold mb-1">售價（NT$）</label>
              <input value={priceTWD} onChange={(e) => setPriceTWD(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">分類</label>
              <select value={categoryId} onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : "")} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white">
                <option value="">請選擇</option>
                {(categories as any[]).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold mb-1">庫存</label>
              <input value={stock} onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ""))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            </div>
          </div>

          <button
            onClick={submit}
            disabled={createMut.isPending}
            className="w-full py-2.5 rounded-lg bg-[#0ABAB5] text-white font-bold text-sm disabled:opacity-60"
          >
            {createMut.isPending ? "上架中..." : "一鍵上架"}
          </button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
