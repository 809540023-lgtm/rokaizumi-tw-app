import { MapPin, HeartHandshake, ShieldCheck } from "lucide-react";

const ITEMS = [
  {
    icon: MapPin,
    title: "大阪直送",
    desc: "日本當地嚴選採購，直送台灣，品質有保障。",
  },
  {
    icon: HeartHandshake,
    title: "專業介護",
    desc: "專注高齡照護用品，貼近長輩實際需求。",
  },
  {
    icon: ShieldCheck,
    title: "安心售後",
    desc: "正品保證、專人服務，購物無後顧之憂。",
  },
];

export function WhyUs() {
  return (
    <section className="py-14 bg-[#FEF9F3]">
      <div className="container mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">為什麼選擇我們</h2>
        <div className="grid md:grid-cols-3 gap-10 md:gap-14 max-w-4xl mx-auto">
          {ITEMS.map((it, i) => {
            const Icon = it.icon;
            return (
              <div key={i} className="text-center px-2">
                <div className="w-14 h-14 mx-auto mb-4 flex items-center justify-center text-[#0ABAB5]">
                  <Icon className="w-9 h-9" strokeWidth={1.5} />
                </div>
                <h3 className="font-bold text-lg mb-2 text-gray-900">{it.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{it.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default WhyUs;
