import { checkGoDaddy } from "../providers/godaddy.js";

(async () => {
  const domain = process.argv[2] || "abhishek.tech";
  const result = await checkGoDaddy(domain, {
    headless: false, // or false locally
    ephemeralProfile: true, // delete profile after run
  });
  console.log(JSON.stringify(result, null, 2));
})();