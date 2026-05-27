import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DATABASE_URL?.split('@')[1]?.split(':')[0] || 'localhost',
  user: process.env.DATABASE_URL?.split('//')[1]?.split(':')[0] || 'root',
  password: process.env.DATABASE_URL?.split(':')[2]?.split('@')[0] || '',
  database: process.env.DATABASE_URL?.split('/').pop() || 'rokaizumi',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

const products = [
  // 健康監測 - 血壓計
  {
    name_zh: 'OMRON 上臂式血壓計 HEM-1000',
    name_en: 'OMRON Automatic Blood Pressure Monitor HEM-1000',
    name_ja: 'オムロン上腕式血圧計 HEM-1000',
    description_zh: '日本歐姆龍品牌自動血壓計，適合高齡者使用。具有自動測量、記憶功能和心律不齊檢測功能。',
    description_en: 'OMRON automatic blood pressure monitor suitable for elderly. Features automatic measurement, memory function, and irregular heartbeat detection.',
    description_ja: 'オムロンの自動血圧計で高齢者に適しています。自動測定、記憶機能、不整脈検出機能を備えています。',
    specifications_zh: '類型：上臂式自動血壓計\n品牌：OMRON（歐姆龍）\n功能：自動測量、60組記憶、心律不齊檢測\n電源：4節AA電池',
    specifications_en: 'Type: Automatic Upper Arm Blood Pressure Monitor\nBrand: OMRON\nFeatures: Automatic measurement, 60 memory records, irregular heartbeat detection\nPower: 4 AA batteries',
    specifications_ja: 'タイプ：上腕式自動血圧計\nブランド：オムロン\n機能：自動測定、60組メモリ、不整脈検出\n電源：4本のAA電池',
    price: 7000,
    category_id: 6, // 健康監測
    status: 'available',
  },
  {
    name_zh: 'OMRON 手腕式血壓計 HEM-6232T',
    name_en: 'OMRON Wrist Blood Pressure Monitor HEM-6232T',
    name_ja: 'オムロン手首式血圧計 HEM-6232T',
    description_zh: '便攜式手腕血壓計，支援藍牙連接，可與手機同步數據。',
    description_en: 'Portable wrist blood pressure monitor with Bluetooth connectivity for smartphone data synchronization.',
    description_ja: 'ポータブル手首式血圧計、Bluetooth接続対応、スマートフォンとのデータ同期可能。',
    specifications_zh: '類型：手腕式血壓計\n品牌：OMRON\n功能：藍牙連接、自動測量、數據同步\n電源：4節AAA電池',
    specifications_en: 'Type: Wrist Blood Pressure Monitor\nBrand: OMRON\nFeatures: Bluetooth connectivity, automatic measurement, data sync\nPower: 4 AAA batteries',
    specifications_ja: 'タイプ：手首式血圧計\nブランド：オムロン\n機能：Bluetooth接続、自動測定、データ同期\n電源：4本のAAA電池',
    price: 5500,
    category_id: 6,
    status: 'available',
  },
  {
    name_zh: 'AND 上臂式血壓計 UA-654Plus',
    name_en: 'AND Upper Arm Blood Pressure Monitor UA-654Plus',
    name_ja: 'AND上腕式血圧計 UA-654Plus',
    description_zh: '日本製高精度血壓計，具有60組記憶功能和心律不齊檢測。',
    description_en: 'Japanese-made high-precision blood pressure monitor with 60 memory records and irregular heartbeat detection.',
    description_ja: '日本製高精度血圧計、60組メモリ機能と不整脈検出機能を搭載。',
    specifications_zh: '類型：上臂式自動血壓計\n品牌：AND（愛安德）\n功能：60組記憶、心律不齊檢測\n測量範圍：收縮壓 0-280mmHg',
    specifications_en: 'Type: Upper Arm Automatic Blood Pressure Monitor\nBrand: AND\nFeatures: 60 memory records, irregular heartbeat detection\nMeasurement range: Systolic 0-280mmHg',
    specifications_ja: 'タイプ：上腕式自動血圧計\nブランド：AND\n機能：60組メモリ、不整脈検出\n測定範囲：収縮期 0-280mmHg',
    price: 6930,
    category_id: 6,
    status: 'available',
  },

  // 健康監測 - 血糖儀
  {
    name_zh: 'LifeScan OneTouch Verio Reflect 血糖測定器',
    name_en: 'LifeScan OneTouch Verio Reflect Glucose Meter',
    name_ja: 'LifeScan OneTouch Verio Reflect 血糖測定器',
    description_zh: '自動檢驗血糖，提供3年保修。傳感器另售。',
    description_en: 'Automatic glucose testing with 3-year warranty. Test strips sold separately.',
    description_ja: '自動血糖検査、3年保証付き。テストストリップは別売り。',
    specifications_zh: '類型：血糖測定器\n品牌：LifeScan\n功能：自動檢驗、數據記錄\n保修：3年',
    specifications_en: 'Type: Glucose Meter\nBrand: LifeScan\nFeatures: Automatic testing, data recording\nWarranty: 3 years',
    specifications_ja: 'タイプ：血糖測定器\nブランド：LifeScan\n機能：自動検査、データ記録\n保証：3年',
    price: 3370,
    category_id: 6,
    status: 'available',
  },
  {
    name_zh: 'Terumo Medisafe Fit 血糖測定器',
    name_en: 'Terumo Medisafe Fit Glucose Meter',
    name_ja: 'Terumo Medisafe Fit 血糖測定器',
    description_zh: '日本製小型便攜血糖測定器，快速檢測血糖值。',
    description_en: 'Japanese-made compact portable glucose meter with quick testing capability.',
    description_ja: '日本製コンパクト携帯用血糖測定器、迅速な検査が可能。',
    specifications_zh: '類型：血糖測定器\n品牌：Terumo（泰爾茂）\n功能：快速檢測、便攜設計\n測定範圍：血糖值 20-600mg/dL',
    specifications_en: 'Type: Glucose Meter\nBrand: Terumo\nFeatures: Quick testing, portable design\nMeasurement range: 20-600mg/dL',
    specifications_ja: 'タイプ：血糖測定器\nブランド：Terumo\n機能：迅速検査、携帯設計\n測定範囲：血糖値 20-600mg/dL',
    price: 4500,
    category_id: 6,
    status: 'available',
  },

  // 護理用品 - 紙尿褲
  {
    name_zh: 'Acti 尿取墊 晝用（2回吸收）',
    name_en: 'Acti Daytime Urine Pad (2-time absorption)',
    name_ja: 'Acti 尿取りパッド 昼用（2回吸収）',
    description_zh: '日本製紙Acti品牌薄型尿取墊，吸收力強，適合日間使用。',
    description_en: 'Japanese-made Acti thin-type urine pad with strong absorption, suitable for daytime use.',
    description_ja: '日本製紙Acti薄型尿取りパッド、吸収力が強く、昼間の使用に適しています。',
    specifications_zh: '類型：尿取墊\n品牌：Acti（日本製紙）\n吸收次數：2回\n規格：30枚×6包（180枚）\n特點：薄型、防漏',
    specifications_en: 'Type: Urine Pad\nBrand: Acti\nAbsorption: 2-time\nSize: 30 pieces × 6 packs (180 pieces)\nFeatures: Thin, leak-proof',
    specifications_ja: 'タイプ：尿取りパッド\nブランド：Acti\n吸収回数：2回\nサイズ：30枚×6パック（180枚）\n特徴：薄型、防漏',
    price: 2500,
    category_id: 7, // 護理用品
    status: 'available',
  },
  {
    name_zh: 'Attent 褲型 夜間1枚安心褲 M尺寸',
    name_en: 'Attent Pants Type Overnight Comfort Pants M Size',
    name_ja: 'Attent パンツ型 夜1枚安心パンツ Mサイズ',
    description_zh: '8回吸收能力，專為夜間長時間使用設計。提供全天候保護。',
    description_en: '8-time absorption capacity, designed for long nighttime use. Provides all-day protection.',
    description_ja: '8回吸収能力、夜間長時間使用向けに設計。終日保護を提供します。',
    specifications_zh: '類型：褲型紙尿褲\n品牌：Attent\n吸收次數：8回\n規格：M尺寸、14枚/包\n特點：夜間長時間使用',
    specifications_en: 'Type: Pants-type Adult Diaper\nBrand: Attent\nAbsorption: 8-time\nSize: M, 14 pieces/pack\nFeatures: Long nighttime use',
    specifications_ja: 'タイプ：パンツ型大人用おむつ\nブランド：Attent\n吸収回数：8回\nサイズ：M、14枚/パック\n特徴：夜間長時間使用',
    price: 3000,
    category_id: 7,
    status: 'available',
  },
  {
    name_zh: 'Lifree 褲型 薄型輕快褲 S尺寸',
    name_en: 'Lifree Pants Type Thin Light Pants S Size',
    name_ja: 'ライフリー パンツ型 薄型軽快パンツ Sサイズ',
    description_zh: '2回吸收薄型設計，適合能自行走動的人士使用。',
    description_en: '2-time absorption thin design, suitable for people who can walk independently.',
    description_ja: '2回吸収薄型設計、自分で歩ける方に適しています。',
    specifications_zh: '類型：褲型紙尿褲\n品牌：Lifree（尤妮佳）\n吸收次數：2回\n規格：S尺寸、34枚/包\n特點：薄型、透氣',
    specifications_en: 'Type: Pants-type Adult Diaper\nBrand: Lifree\nAbsorption: 2-time\nSize: S, 34 pieces/pack\nFeatures: Thin, breathable',
    specifications_ja: 'タイプ：パンツ型大人用おむつ\nブランド：ライフリー\n吸収回数：2回\nサイズ：S、34枚/パック\n特徴：薄型、通気性',
    price: 2800,
    category_id: 7,
    status: 'available',
  },

  // 護理用品 - 防褥瘡
  {
    name_zh: 'Geltron 薄款凝膠防褥瘡護理床墊',
    name_en: 'Geltron Thin Gel Anti-Bedsore Nursing Mattress',
    name_ja: 'Geltron 薄型ゲル褥瘡予防ケアマットレス',
    description_zh: '2cm超薄設計，採用高通風聚氨酯材質，提供精細網格支撐，有效防止褥瘡。',
    description_en: '2cm ultra-thin design with high-ventilation polyurethane material, provides fine mesh support to prevent bedsores effectively.',
    description_ja: '2cm超薄設計、高通風ポリウレタン素材を採用、細かいメッシュサポートを提供し、褥瘡を効果的に防止します。',
    specifications_zh: '類型：防褥瘡床墊\n品牌：Geltron\n厚度：2cm\n材質：聚氨酯、凝膠\n特點：超薄、透氣',
    specifications_en: 'Type: Anti-Bedsore Mattress\nBrand: Geltron\nThickness: 2cm\nMaterial: Polyurethane, Gel\nFeatures: Ultra-thin, breathable',
    specifications_ja: 'タイプ：褥瘡予防マットレス\nブランド：Geltron\n厚さ：2cm\n素材：ポリウレタン、ゲル\n特徴：超薄、通気性',
    price: 20000,
    category_id: 7,
    status: 'available',
  },
  {
    name_zh: 'Platz New Point 3吋護理床褥',
    name_en: 'Platz New Point 3-inch Nursing Mattress',
    name_ja: 'Platz New Point 3インチケアマットレス',
    description_zh: '多層構造設計，具有抗菌、防臭、防燃、防蟎蟲功能。適合癱瘓病人使用。',
    description_en: 'Multi-layer structure design with antibacterial, deodorizing, flame-retardant, and dust mite-proof functions. Suitable for bedridden patients.',
    description_ja: '多層構造設計、抗菌、防臭、防燃、防ダニ機能を備えています。寝たきり患者に適しています。',
    specifications_zh: '類型：護理床褥\n品牌：Platz\n厚度：3吋\n材質：多層構造\n特點：抗菌、防臭、防燃',
    specifications_en: 'Type: Nursing Mattress\nBrand: Platz\nThickness: 3 inches\nMaterial: Multi-layer structure\nFeatures: Antibacterial, deodorizing, flame-retardant',
    specifications_ja: 'タイプ：ケアマットレス\nブランド：Platz\n厚さ：3インチ\n素材：多層構造\n特徴：抗菌、防臭、防燃',
    price: 27500,
    category_id: 7,
    status: 'available',
  },

  // 床邊照護 - 扶手
  {
    name_zh: '安壽 床邊扶手',
    name_en: 'Anjyu Bedside Handrail',
    name_ja: '安壽 ベッドサイドハンドレール',
    description_zh: '日本安壽品牌床邊扶手，安全設計，幫助患者起身和移動。',
    description_en: 'Japanese Anjyu bedside handrail with safe design to help patients get up and move.',
    description_ja: '日本の安壽ベッドサイドハンドレール、安全設計で患者の起身と移動を支援します。',
    specifications_zh: '類型：床邊扶手\n品牌：安壽（Anjyu）\n材質：鋼鐵、塑膠\n功能：起身輔助、安全支撐\n承重：最大100kg',
    specifications_en: 'Type: Bedside Handrail\nBrand: Anjyu\nMaterial: Steel, plastic\nFunction: Get-up assistance, safety support\nWeight capacity: Max 100kg',
    specifications_ja: 'タイプ：ベッドサイドハンドレール\nブランド：安壽\n素材：鋼、プラスチック\n機能：起身支援、安全サポート\n耐荷重：最大100kg',
    price: 11500,
    category_id: 8, // 床邊照護
    status: 'available',
  },

  // 床邊照護 - 洗澡椅
  {
    name_zh: 'CPE-N 無背洗澡椅',
    name_en: 'CPE-N Backless Shower Chair',
    name_ja: 'CPE-N 背なし浴用椅子',
    description_zh: '安壽品牌無背洗澡椅，防霉加工EVA軟墊，簡單樸實的安心設計。',
    description_en: 'Anjyu backless shower chair with mold-proof EVA soft pad, simple and reassuring design.',
    description_ja: '安壽背なし浴用椅子、防カビ加工EVAソフトパッド、シンプルで安心の設計。',
    specifications_zh: '類型：無背洗澡椅\n品牌：安壽（Anjyu）\n材質：鋁合金、EVA軟墊\n特點：防霉、防滑\n座高：可調整',
    specifications_en: 'Type: Backless Shower Chair\nBrand: Anjyu\nMaterial: Aluminum alloy, EVA soft pad\nFeatures: Mold-proof, non-slip\nSeat height: Adjustable',
    specifications_ja: 'タイプ：背なし浴用椅子\nブランド：安壽\n素材：アルミ合金、EVAソフトパッド\n特徴：防カビ、滑り止め\n座面高さ：調整可能',
    price: 10000,
    category_id: 8,
    status: 'available',
  },
  {
    name_zh: 'NOVA 可調有背洗澡椅 9020CA',
    name_en: 'NOVA Adjustable Backed Shower Chair 9020CA',
    name_ja: 'NOVA 調整可能背付き浴用椅子 9020CA',
    description_zh: '有背設計提供額外支撐，可調整座高，米色設計美觀。',
    description_en: 'Backed design provides extra support, adjustable seat height, beige color design.',
    description_ja: '背付き設計で追加サポートを提供、座面高さ調整可能、ベージュ色のデザイン。',
    specifications_zh: '類型：有背洗澡椅\n品牌：NOVA\n材質：鋁合金、EVA軟墊\n特點：可調整、有背支撐\n座高：可調整\n顏色：米色',
    specifications_en: 'Type: Backed Shower Chair\nBrand: NOVA\nMaterial: Aluminum alloy, EVA soft pad\nFeatures: Adjustable, backed support\nSeat height: Adjustable\nColor: Beige',
    specifications_ja: 'タイプ：背付き浴用椅子\nブランド：NOVA\n素材：アルミ合金、EVAソフトパッド\n特徴：調整可能、背付きサポート\n座面高さ：調整可能\n色：ベージュ',
    price: 12500,
    category_id: 8,
    status: 'available',
  },

  // 復健器材
  {
    name_zh: '握力訓練器',
    name_en: 'Hand Grip Strength Trainer',
    name_ja: '握力トレーニング器',
    description_zh: '可調整阻力的握力訓練器，幫助手部力量訓練和復健。',
    description_en: 'Adjustable resistance hand grip trainer for hand strength training and rehabilitation.',
    description_ja: '調整可能な抵抗力を持つ握力トレーニング器、手の力の訓練とリハビリに役立ちます。',
    specifications_zh: '類型：握力訓練器\n材質：橡膠、鋼鐵\n特點：可調阻力、便攜\n功能：手部力量訓練、復健\n承重：最大50kg',
    specifications_en: 'Type: Hand Grip Trainer\nMaterial: Rubber, steel\nFeatures: Adjustable resistance, portable\nFunction: Hand strength training, rehabilitation\nCapacity: Max 50kg',
    specifications_ja: 'タイプ：握力トレーニング器\n素材：ゴム、鋼\n特徴：調整可能な抵抗、携帯可能\n機能：手の力の訓練、リハビリ\n容量：最大50kg',
    price: 3500,
    category_id: 9, // 復健器材
    status: 'available',
  },
  {
    name_zh: '腳踏訓練機',
    name_en: 'Pedal Exerciser',
    name_ja: 'ペダルエクササイザー',
    description_zh: '可調速度的腳踏訓練機，適合下肢訓練和心肺功能提升。',
    description_en: 'Adjustable speed pedal exerciser suitable for lower limb training and cardiovascular fitness.',
    description_ja: '調整可能な速度のペダルエクササイザー、下肢トレーニングと心肺機能向上に適しています。',
    specifications_zh: '類型：腳踏訓練機\n材質：鋼鐵、塑膠\n特點：可調速度、便攜\n功能：下肢訓練、心肺功能\n尺寸：小型便攜',
    specifications_en: 'Type: Pedal Exerciser\nMaterial: Steel, plastic\nFeatures: Adjustable speed, portable\nFunction: Lower limb training, cardiovascular fitness\nSize: Compact and portable',
    specifications_ja: 'タイプ：ペダルエクササイザー\n素材：鋼、プラスチック\n特徴：調整可能な速度、携帯可能\n機能：下肢トレーニング、心肺機能\nサイズ：コンパクト携帯可能',
    price: 7500,
    category_id: 9,
    status: 'available',
  },
  {
    name_zh: 'muva遠紅外線專業支撐護膝L',
    name_en: 'muva Far Infrared Professional Support Knee Brace L',
    name_ja: 'muva遠赤外線プロフェッショナルサポート膝サポーターL',
    description_zh: '採用日本進口超彈性纖維，具有遠紅外線功能，提供膝蓋支撐和血液循環促進。',
    description_en: 'Made with Japanese imported super elastic fiber with far infrared function, provides knee support and promotes blood circulation.',
    description_ja: '日本輸入超弾性繊維を採用、遠赤外線機能付き、膝サポートと血液循環促進を提供します。',
    specifications_zh: '類型：護膝\n品牌：muva\n材質：日本進口超彈性纖維\n特點：遠紅外線、吸濕排汗\n尺寸：L\n功能：膝蓋支撐、血液循環',
    specifications_en: 'Type: Knee Brace\nBrand: muva\nMaterial: Japanese imported super elastic fiber\nFeatures: Far infrared, moisture-wicking\nSize: L\nFunction: Knee support, blood circulation',
    specifications_ja: 'タイプ：膝サポーター\nブランド：muva\n素材：日本輸入超弾性繊維\n特徴：遠赤外線、吸湿発散\nサイズ：L\n機能：膝サポート、血液循環',
    price: 4000,
    category_id: 9,
    status: 'available',
  },
  {
    name_zh: '可摺疊多功能健腹健身椅',
    name_en: 'Foldable Multi-function Abdominal Fitness Chair',
    name_ja: '折りたたみ式多機能腹部フィットネスチェア',
    description_zh: '多功能健身椅，可摺疊設計便於收納，適合腹部訓練和核心肌群鍛鍊。',
    description_en: 'Multi-function fitness chair with foldable design for easy storage, suitable for abdominal training and core muscle strengthening.',
    description_ja: '多機能フィットネスチェア、折りたたみ設計で収納が簡単、腹部トレーニングとコア筋力強化に適しています。',
    specifications_zh: '類型：健身椅\n品牌：NutroOne\n材質：鋼鐵、泡棉\n特點：多功能、可摺疊\n功能：腹部訓練、核心肌群\n承重：最大150kg',
    specifications_en: 'Type: Fitness Chair\nBrand: NutroOne\nMaterial: Steel, foam\nFeatures: Multi-function, foldable\nFunction: Abdominal training, core muscles\nWeight capacity: Max 150kg',
    specifications_ja: 'タイプ：フィットネスチェア\nブランド：NutroOne\n素材：鋼、フォーム\n特徴：多機能、折りたたみ可能\n機能：腹部トレーニング、コア筋\n耐荷重：最大150kg',
    price: 12000,
    category_id: 9,
    status: 'available',
  },
];

async function addProducts() {
  const connection = await pool.getConnection();
  try {
    for (const product of products) {
      const query = `
        INSERT INTO products (
          name, description, specifications, price, category_id, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;
      
      // 使用中文名稱作為主要名稱
      const name = product.name_zh;
      const description = product.description_zh;
      const specifications = product.specifications_zh;
      
      await connection.execute(query, [
        name,
        description,
        specifications,
        product.price,
        product.category_id,
        product.status,
      ]);
      
      console.log(`✓ Added: ${name}`);
    }
    
    console.log(`\n✅ Successfully added ${products.length} products!`);
  } catch (error) {
    console.error('Error adding products:', error);
  } finally {
    await connection.release();
    await pool.end();
  }
}

addProducts();
