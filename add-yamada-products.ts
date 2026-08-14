import { drizzle } from 'drizzle-orm/mysql2';
import { products, categories } from './drizzle/schema';

const db = drizzle(process.env.DATABASE_URL!);

async function addYamadaProducts() {
  try {
    console.log('開始添加山田化學(Yamada Kagaku)產品...');

    // 獲取所有分類
    const allCategories = await db.select().from(categories);
    const categoryMap = new Map(allCategories.map(c => [c.name, c.id]));

    // 山田化學產品數據
    const yamadaProducts = [
      { sku: '3568', name: 'ピッケ 2段ランチボックス フェミニン' },
      { sku: '3571', name: 'ピッケ はしケースセット18 フェミニン' },
      { sku: '3569', name: 'ピッケ オーバルランチパック フェミニン' },
      { sku: '1800', name: 'G&B フタ付きマグカップ ホワイト' },
      { sku: '1800', name: 'G&B フタ付きマグカップ グレー' },
      { sku: '1800', name: 'G&B フタ付きマグカップ ペールピンク' },
      { sku: '1803', name: 'G&B ランチボックス SP付き ホワイト' },
      { sku: '1806', name: 'G&B オーバルランチパック アソート' },
      { sku: '1807', name: 'G&B スリムランチパック アソート' },
      { sku: '1808', name: 'G&B おにぎり2P アソート' },
      { sku: '1810', name: 'G&B サンドイッチケース アソート' },
      { sku: '1811', name: 'G&B はしケースセット グレー' },
      { sku: '1811', name: 'G&B はしケースセット ホワイト' },
      { sku: '887', name: 'G&B フォーク8P モノトーン' },
      { sku: '887', name: 'G&B フォーク8P カラー' },
      { sku: '888', name: 'G&B スプーン8P モノトーン' },
      { sku: '888', name: 'G&B スプーン8P カラー' },
      { sku: '1817', name: 'G&B アイススプーン8P モノトーン' },
      { sku: '1828', name: 'アイススプーン8P ペールカラー' },
      { sku: '3556', name: 'ガラス風スプーン POPカラー' },
      { sku: '1812', name: 'G&B トリオセット アソート' },
      { sku: '1818', name: 'G&B カトラリー3点セット ペールピンク' },
      { sku: '1818', name: 'G&B カトラリー3点セット グレー' },
      { sku: '1818', name: 'G&B カトラリー3点セット ホワイト' },
      { sku: '873', name: 'G&B ベルト2P ベージュ' },
      { sku: '873', name: 'G&B ベルト2P ピンク' },
      { sku: '873', name: 'G&B ベルト2P ブルー' },
      { sku: '1099', name: 'シリコンランチベルト リボン' },
      { sku: '824', name: 'ノアールデリ 密封深870 ブラック' },
      { sku: '824', name: 'ノアールデリ 密封深870 ネイビー' },
      { sku: '825', name: 'ノアールデリ はしケースセット' },
      { sku: '826', name: 'ノアールデリ ランチベルト2P' },
      { sku: '751', name: '丈夫な箸ケース18' },
      { sku: '752', name: '丈夫な箸ケース21' },
      { sku: '753', name: '丈夫なカトラリーケース19' },
      { sku: '3565', name: 'カトラリー2点セット ホワイト' },
      { sku: '1588', name: 'ボヌールはしケースセット' },
      { sku: '1585', name: 'ボヌールマグカップ レッド' },
      { sku: '1587', name: 'ボヌールスープマグ レッド' },
      { sku: '1593', name: 'ボヌールNEWランチポットM レッド' },
      { sku: '1595', name: 'ボヌールNEWランチポットLL レッド' },
      { sku: '1598', name: 'ボヌールランチスクエアL レッド' },
      { sku: '1596', name: 'ボヌールランチスクエアLL レッド' },
      { sku: '1060', name: 'ボヌール ランチスクエア3L レッド' },
      { sku: '1060', name: 'ボヌール ランチスクエア3L ダークグレー' },
      { sku: '1583', name: 'ボヌールミニカップS2P' },
      { sku: '1584', name: 'ボヌールミニカップSS3P' },
      { sku: '1586', name: 'ボヌール マグキャップ' },
      { sku: '1599', name: 'ボヌール ケース付スプーン レッド' },
      { sku: '1599', name: 'ボヌール ケース付スプーン ダークグレー' },
      { sku: '3530', name: 'ネスタ仕切り付きランチボックス フラフィ' },
      { sku: '3563', name: 'おにぎりランチボックス' },
      { sku: '3550', name: 'ミールプレップ容器 sikiri2' },
      { sku: '3551', name: 'ミールプレップ容器 sikiri3' },
      { sku: '3552', name: 'ミールプレップ容器 sikiri4' },
      { sku: '3500', name: '家事をへらす保存食器L' },
      { sku: '3501', name: '家事をへらす保存食器M' },
      { sku: '3502', name: '家事をへらす保存食器S' },
      { sku: '3503', name: '家事をへらす保存食器SS' },
      { sku: '3525', name: '保温保冷タンブラー TH' },
      { sku: '1150', name: 'チェリーノマグ アニマル' },
      { sku: '3510', name: 'ジョルノマグ あじさいブルー' },
      { sku: '3510', name: 'ジョルノマグ さくらピンク' },
      { sku: '3553', name: 'プレーンマグ' },
      { sku: '3522', name: 'すくいやすい食器 M' },
      { sku: '3521', name: 'すくいやすい食器 S' },
      { sku: '3526', name: '食パン皿' },
      { sku: '3250', name: '粉ミルクスプーン' },
      { sku: '3334', name: 'しぼれるパウチスタンド' },
      { sku: '3573', name: '幼児食器 ボウル' },
      { sku: '3574', name: '幼児食器 スプーン2P&おやつケース' },
      { sku: '3575', name: '幼児食器 プレート' },
      { sku: '3576', name: '幼児食器 両手マグ' },
      { sku: '3557', name: 'バイカラーコップ300 ポップ' },
      { sku: '3557', name: 'バイカラーコップ300 シンプル' },
      { sku: '3539', name: 'キフレ グラス M クリア' },
      { sku: '3539', name: 'キフレ グラス M アンバー' },
      { sku: '3539', name: 'キフレ グラス M ブルーグレー' },
      { sku: '3540', name: 'キフレ グラス L カラー' },
      { sku: '3539', name: 'キフレ グラス M カラー' },
      { sku: '3541', name: 'キフレ マグ カラー' },
      { sku: '3537', name: 'キフレ ボウル S カラー' },
      { sku: '1562', name: 'PSタンブラー L' },
    ];

    // 取得廚房用品分類ID（如果不存在則使用第一個分類）
    const kitchenCategoryId = categoryMap.get('廚房用品') ||
                               Array.from(categoryMap.values())[0];

    let addedCount = 0;

    // 插入產品
    for (const product of yamadaProducts) {
      const productData = {
        name: product.name,
        description: `山田化學(Yamada Kagaku)製品 - 品番: 3/yama~${product.sku}`,
        price: 99, // 默認價格，需要後續更新
        categoryId: kitchenCategoryId,
        imageUrl: 'https://via.placeholder.com/400x400/FFE5CC/FF6B35?text=山田化學商品',
        status: 'available' as const,
        specifications: `品番: 3/yama~${product.sku}`,
        sku: `3/yama~${product.sku}`,
      };

      try {
        await db.insert(products).values(productData);
        addedCount++;
        console.log(`✓ 已添加: ${product.name} (3/yama~${product.sku})`);
      } catch (error: any) {
        console.log(`⚠ 產品已存在或發生錯誤: ${product.name}`);
      }
    }

    console.log(`\n✅ 成功添加 ${addedCount} 個山田化學產品！`);
    console.log(`品番格式: 3/yama~[編號]`);
    process.exit(0);
  } catch (error) {
    console.error('❌ 添加產品時發生錯誤：', error);
    process.exit(1);
  }
}

addYamadaProducts();
