const points = [
  { title: "大阪直送", desc: "日本當地嚴選採購，直送台灣，品質有保障。" },
  { title: "專業介護", desc: "專注高齡照護用品，貼近長輩實際需求。" },
  { title: "安心售後", desc: "正品保證、專人服務，購物無後顧之憂。" },
];

export function WhyUs() {
  return (
    <section className="container mx-auto px-4 py-12">
      <h2 className="text-2xl font-bold text-center mb-8">為什麼選擇我們</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {points.map((p) => (
          <div key={p.title} className="bg-white rounded-2xl p-6 text-center shadow-sm">
            <div className="font-bold text-lg mb-2 text-[#0ABAB5]">{p.title}</div>
            <p className="text-sm text-gray-600 leading-relaxed">{p.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default WhyUs;
