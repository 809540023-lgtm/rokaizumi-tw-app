#!/bin/bash

echo "🔧 === 資料庫初始化腳本 ==="
echo ""

# 檢查是否已有 DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL 未設定"
  echo ""
  echo "📋 嘗試從 Render MySQL 資料庫配置..."
  
  # 如果有 RENDER_DATABASE_URL（Render 自動提供的）
  if [ ! -z "$RENDER_DATABASE_URL" ]; then
    export DATABASE_URL=$RENDER_DATABASE_URL
    echo "✓ 使用 RENDER_DATABASE_URL"
  fi
fi

# 再次檢查
if [ -z "$DATABASE_URL" ]; then
  echo "❌ 仍無法找到資料庫連接"
  echo ""
  echo "💡 可能的解決方案:"
  echo "1. 檢查 Render Dashboard 中的環境變數"
  echo "2. 確認 MySQL 資料庫已建立"
  echo "3. 手動設定 DATABASE_URL"
  exit 1
fi

echo "✓ DATABASE_URL 已設定"

# 執行數據庫遷移
echo ""
echo "🔄 運行數據庫遷移..."
npm run db:push || {
  echo "❌ 遷移失敗"
  exit 1
}

echo "✅ 資料庫初始化完成"
