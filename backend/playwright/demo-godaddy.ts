import dotenv from "dotenv";
dotenv.config();

import { checkGoDaddy } from "./providers/godaddy";

(async () => {
  const domain = process.argv[2] || "abhishek.tech";
  const result = await checkGoDaddy(domain);
  console.log("GoDaddy result:", JSON.stringify(result, null, 2));
})();