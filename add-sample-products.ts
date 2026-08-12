import { drizzle } from 'drizzle-orm/mysql2';
import { products, categories } from './drizzle/schema';
import { eq } from 'drizzle-orm';

const db = drizzle(process.env.DATABASE_URL!);

async function addSampleProducts() {
  try {
    console.log('開始添加示範產品...');
    
    // 獲取所有分類
    const allCategories = await db.select().from(categories);
    const categoryMap = new Map(allCategories.map(c => [c.name, c.id]));
    
    const sampleProducts = [
      // 日本百元商品 - 日用百貨
      {
        name: '日本製收納盒套裝',
        description: '多功能透明收納盒，適合廚房、浴室、辦公室使用',
        price: 150,
        categoryId: categoryMap.get('日用百貨')!,
        imageUrl: 'https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=收納盒套裝',
        status: 'available' as const,
        specifications: '尺寸：大中小三件套，材質：PP塑料',
      },
      {
        name: '日式便當盒',
        description: '雙層設計，微波爐可用，附餐具',
        price: 120,
        categoryId: categoryMap.get('廚房用品')!,
        imageUrl: 'https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=便當盒',
        status: 'available' as const,
        specifications: '容量：800ml，材質：食品級PP',
      },
      {
        name: '無印風文具套裝',
        description: '簡約設計，包含筆記本、原子筆、便利貼',
        price: 100,
        categoryId: categoryMap.get('文具用品')!,
        imageUrl: 'https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=文具套裝',
        status: 'available' as const,
        specifications: '內含：A5筆記本、3支原子筆、便利貼3本',
      },
      {
        name: '廚房清潔海綿組',
        description: '日本製高品質海綿，不傷鍋具',
        price: 80,
        categoryId: categoryMap.get('清潔用品')!,
        imageUrl: 'https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=清潔海綿',
        status: 'available' as const,
        specifications: '數量：10片裝，材質：聚氨酯',
      },
      {
        name: '抽屜分隔板組',
        description: '可調節尺寸，適合各種抽屜',
        price: 90,
        categoryId: categoryMap.get('收納用品')!,
        imageUrl: 'https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=分隔板',
        status: 'available' as const,
        specifications: '長度可調：28-42cm，材質：ABS',
      },
      {
        name: '日本面膜套裝',
        description: '保濕美白，適合各種膚質',
        price: 180,
        categoryId: categoryMap.get('美妝保養')!,
        imageUrl: 'https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=面膜套裝',
        status: 'available' as const,
        specifications: '數量：30片，成分：玻尿酸、膠原蛋白',
      },
      {
        name: '日本零食禮盒',
        description: '精選日本人氣零食，送禮自用兩相宜',
        price: 250,
        categoryId: categoryMap.get('食品零食')!,
        imageUrl: 'https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=零食禮盒',
        status: 'available' as const,
        specifications: '內含：餅乾、糖果、巧克力等10種',
      },
      {
        name: '卡通造型玩具',
        description: '可愛造型，安全無毒',
        price: 110,
        categoryId: categoryMap.get('玩具雜貨')!,
        imageUrl: 'https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=玩具',
        status: 'available' as const,
        specifications: '材質：ABS塑料，適合3歲以上',
      },
      
      // 老人看護器材 - 行動輔助
      {
        name: '鋁合金四腳拐杖',
        description: '輕量化設計，高度可調節，防滑橡膠腳墊',
        price: 800,
        categoryId: categoryMap.get('行動輔助')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=四腳拐杖',
        status: 'available' as const,
        specifications: '高度：75-95cm可調，承重：100kg，重量：0.8kg',
      },
      {
        name: '折疊式助行器',
        description: '輕鬆折疊收納，附置物袋，適合室內外使用',
        price: 1500,
        categoryId: categoryMap.get('行動輔助')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=助行器',
        status: 'available' as const,
        specifications: '尺寸：60x50x85cm，承重：120kg，重量：3.5kg',
      },
      {
        name: '浴室安全扶手',
        description: '不銹鋼材質，強力吸盤固定，防滑設計',
        price: 600,
        categoryId: categoryMap.get('衛浴安全')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=浴室扶手',
        status: 'available' as const,
        specifications: '長度：40cm，材質：304不銹鋼，承重：150kg',
      },
      {
        name: '防滑沐浴椅',
        description: '高度可調，背靠舒適，排水孔設計',
        price: 1200,
        categoryId: categoryMap.get('衛浴安全')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=沐浴椅',
        status: 'available' as const,
        specifications: '高度：35-50cm可調，承重：150kg',
      },
      {
        name: '電子血壓計',
        description: '日本品牌，自動測量，大螢幕顯示',
        price: 1800,
        categoryId: categoryMap.get('健康監測')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=血壓計',
        status: 'available' as const,
        specifications: '測量範圍：0-299mmHg，記憶：60組',
      },
      {
        name: '血糖測試儀套裝',
        description: '快速準確，附50片試紙和採血針',
        price: 2200,
        categoryId: categoryMap.get('健康監測')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=血糖儀',
        status: 'available' as const,
        specifications: '測試時間：5秒，記憶：500組',
      },
      {
        name: '成人紙尿褲（L號）',
        description: '超強吸收，透氣舒適，防漏設計',
        price: 450,
        categoryId: categoryMap.get('護理用品')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=紙尿褲',
        status: 'available' as const,
        specifications: '尺寸：L（腰圍80-120cm），數量：20片',
      },
      {
        name: '防褥瘡氣墊床',
        description: '交替充氣，促進血液循環，靜音設計',
        price: 3500,
        categoryId: categoryMap.get('護理用品')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=氣墊床',
        status: 'available' as const,
        specifications: '尺寸：190x90cm，承重：150kg',
      },
      {
        name: '手部復健握力器',
        description: '可調阻力，適合中風復健',
        price: 350,
        categoryId: categoryMap.get('復健器材')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=握力器',
        status: 'available' as const,
        specifications: '阻力：10-40kg可調，材質：TPR',
      },
      {
        name: '腳踏復健器',
        description: '上下肢訓練，電子計數，可折疊',
        price: 1800,
        categoryId: categoryMap.get('復健器材')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=復健器',
        status: 'available' as const,
        specifications: '阻力：5段可調，計數器：LCD顯示',
      },
      {
        name: '長柄取物夾',
        description: '不彎腰輕鬆取物，防滑夾頭',
        price: 280,
        categoryId: categoryMap.get('生活輔具')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=取物夾',
        status: 'available' as const,
        specifications: '長度：82cm，夾持力：1kg',
      },
      {
        name: '穿襪輔助器',
        description: '輕鬆穿脫襪子，附長握把',
        price: 320,
        categoryId: categoryMap.get('生活輔具')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=穿襪器',
        status: 'available' as const,
        specifications: '材質：塑料+泡棉，握把長度：75cm',
      },
      {
        name: '床邊起身扶手',
        description: '固定在床墊下，協助起身',
        price: 1200,
        categoryId: categoryMap.get('床邊照護')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=起身扶手',
        status: 'available' as const,
        specifications: '高度：40cm，承重：120kg',
      },
      {
        name: '緊急呼叫器',
        description: '一鍵呼叫，防水設計，可穿戴',
        price: 1500,
        categoryId: categoryMap.get('安全監控')!,
        imageUrl: 'https://via.placeholder.com/400x400/E3F2FD/1976D2?text=呼叫器',
        status: 'available' as const,
        specifications: '通訊距離：100m，電池：可充電',
      },
    ];
    
    // 插入產品
    for (const product of sampleProducts) {
      await db.insert(products).values(product);
      console.log(`✓ 已添加產品：${product.name}`);
    }
    
    console.log(`\n✅ 成功添加 ${sampleProducts.length} 個示範產品！`);
    process.exit(0);
  } catch (error) {
    console.error('❌ 添加產品時發生錯誤：', error);
    process.exit(1);
  }
}

addSampleProducts();
