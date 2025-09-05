// scripts/seedUserCache.ts
import { setUsernameFid } from "./src/services/usernameCache.ts";

async function main() {
  console.log("🌱 Seeding username → fid cache...");

  await setUsernameFid("jack", 2);
  await setUsernameFid("alice", 1234);
  await setUsernameFid("bob", 5678);

  console.log("✅ Done seeding cache.");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
