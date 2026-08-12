import { Heart, Shield, Truck } from "lucide-react";

const items = [
  { icon: Heart, title: "精選品質", desc: "嚴選日本優質介護品牌" },
  { icon: Shield, title: "安心保障", desc: "正品保證，品質有保證" },
  { icon: Truck, title: "快速配送", desc: "專業包裝，安全送達" },
];

export function TrustRow() {
  return (
    <div className="container mx-auto px-4 -mt-8 relative z-10">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.title} className="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#FDECEA] flex items-center justify-center shrink-0">
                <Icon className="w-6 h-6 text-[#E26D5C]" />
              </div>
              <div>
                <div className="font-bold">{it.title}</div>
                <div className="text-sm text-gray-500">{it.desc}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TrustRow;
