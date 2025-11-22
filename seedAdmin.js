// seedAdmin.js
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();
const User = require("./models/userModel"); // adjust path if needed

async function main() {
  // ensure env var
  const mongoUrl = process.env.MONGODB_URL || process.env.MONGO_URI;
  if (!mongoUrl) {
    console.error("❌ ERROR: Set MONGODB_URL or MONGO_URI in your .env");
    process.exit(1);
  }

  await mongoose.connect(mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  console.log("✅ Connected to MongoDB");

  const adminEmail = "admin@example.com";
  const plainPassword = "Admin@12345"; // change if you want
  const saltRounds = 10;
  const hashed = await bcrypt.hash(plainPassword, saltRounds);

  // Base admin data you explicitly want
  const adminData = {
    firstname: "Admin", // explicit
    lastname: "User", // explicit
    email: adminEmail,
    mobile: "0000000000",
    password: hashed, // hashed password (keep if your model doesn't hash automatically)
    role: "admin",
  };

  // Auto-fill any other required schema fields that are missing
  const autoFilled = {};
  const skipPaths = new Set([
    "_id",
    "__v",
    "createdAt",
    "updatedAt",
    "passwordResetToken",
    "passwordResetExpires",
  ]);

  for (const pathName of Object.keys(User.schema.paths)) {
    if (skipPaths.has(pathName)) continue;

    const path = User.schema.paths[pathName];
    // If path has required validator and adminData doesn't provide a value
    const isRequired =
      (path.options && path.options.required) ||
      // support function-based required declarations
      (Array.isArray(path.validators) &&
        path.validators.some((v) => v.type === "required"));

    if (
      isRequired &&
      (adminData[pathName] === undefined || adminData[pathName] === "")
    ) {
      // create a reasonable default based on path type/name
      let defaultVal = "";
      if (pathName.toLowerCase().includes("email")) defaultVal = adminEmail;
      else if (pathName.toLowerCase().includes("name")) defaultVal = "Admin";
      else if (
        pathName.toLowerCase().includes("mobile") ||
        pathName.toLowerCase().includes("phone")
      )
        defaultVal = "0000000000";
      else if (pathName === "password") defaultVal = hashed;
      else defaultVal = `auto_${pathName}`;

      adminData[pathName] = defaultVal;
      autoFilled[pathName] = defaultVal;
    }
  }

  try {
    const existing = await User.findOne({ email: adminEmail });

    if (!existing) {
      const created = await User.create(adminData);
      console.log("🎉 Admin user created:", created.email);
      if (Object.keys(autoFilled).length) {
        console.log("📝 Auto-filled required fields:", autoFilled);
      }
    } else {
      // update existing: overwrite password and role & any auto-filled required fields
      existing.password = hashed;
      existing.role = "admin";
      for (const k of Object.keys(autoFilled)) existing[k] = autoFilled[k];
      // also copy firstname/lastname/mobile if present in adminData
      existing.firstname = adminData.firstname;
      existing.lastname = adminData.lastname;
      existing.mobile = adminData.mobile;
      await existing.save();
      console.log("🔁 Admin user updated (password & role reset).");
      if (Object.keys(autoFilled).length) {
        console.log(
          "📝 Auto-filled required fields on existing user:",
          autoFilled
        );
      }
    }
  } catch (err) {
    console.error("❌ Error creating/updating admin:", err);
  } finally {
    await mongoose.disconnect();
    console.log("🔌 Disconnected");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("❌ Fatal:", err);
  mongoose.disconnect().catch(() => {});
  process.exit(1);
});
