import { checkNamecheap } from "../providers/namecheap.js";

(async () => {
  const domain = process.argv[2] || "abhishekbr.dev";
  const res = await checkNamecheap(domain, {
    headless: false,
    ephemeralProfile: true,
  });
  console.log(JSON.stringify(res, null, 2));
})();