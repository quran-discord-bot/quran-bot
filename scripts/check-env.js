#!/usr/bin/env node
import { configDotenv } from "dotenv";

// Load environment variables
configDotenv();

console.log("🔧 Environment Variables Check:");
console.log("================================");

const requiredVars = ["BOT_TOKEN", "CLIENT_ID", "GUILD_ID", "NODE_ENV"];
const optionalVars = ["LOG_LEVEL", "DATABASE_URL", "REDIS_URL"];

console.log("\n📋 Required Variables:");
requiredVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    // Mask sensitive values
    const maskedValue =
      varName === "BOT_TOKEN"
        ? value.substring(0, 10) + "..." + value.slice(-4)
        : value;
    console.log(`✅ ${varName}: ${maskedValue}`);
  } else {
    console.log(`❌ ${varName}: NOT SET`);
  }
});

console.log("\n🔧 Optional Variables:");
optionalVars.forEach((varName) => {
  const value = process.env[varName];
  if (value) {
    console.log(`✅ ${varName}: ${value}`);
  } else {
    console.log(`➖ ${varName}: Not set (optional)`);
  }
});

console.log("\n🐳 Docker Environment Check:");
console.log("These variables will be passed to Docker containers.");

// Check if all required variables are present
const missingRequired = requiredVars.filter((varName) => !process.env[varName]);
if (missingRequired.length > 0) {
  console.log(
    `\n⚠️  Missing required variables: ${missingRequired.join(", ")}`
  );
  process.exit(1);
} else {
  console.log("\n🎉 All required environment variables are configured!");
}
