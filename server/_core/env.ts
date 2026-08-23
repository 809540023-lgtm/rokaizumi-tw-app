// 驗證環境變量
function validateEnv() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl && process.env.NODE_ENV === "production") {
    console.error("⚠️  警告: DATABASE_URL 環境變量未設定!");
    console.error("   已知的 TiDB Cloud 信息:");
    console.error("   Host: gateway02.us-east-1.prod.aws.tidbcloud.com:4000");
    console.error("   Database: bMn2Gb7rjKtySEiV2r5RyX");
    console.error("   User: 3FVGt3RqCkiFaDE.0fde5e63513d");
    console.error("   密碼需要在 Render Dashboard 設定");
  }
}

validateEnv();

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
};
