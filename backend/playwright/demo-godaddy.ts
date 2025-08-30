import { checkGoDaddyDirect } from "./providers/godaddy";

(async () => {
  const domain = process.argv[2] || "abhishek.tech";
  const result = await checkGoDaddyDirect(domain, {
    headless: false, // or false locally
    ephemeralProfile: true, // delete profile after run
  });
  console.log(JSON.stringify(result, null, 2));
})();