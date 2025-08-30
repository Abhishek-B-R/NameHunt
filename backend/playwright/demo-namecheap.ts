import { checkNamecheap } from "./providers/namecheap";

(async () => {
  const domain = process.argv[2] || "abhishekbr.dev";
  const res = await checkNamecheap(domain, {
    headless: false,
    ephemeralProfile: true,
  });
  console.log(JSON.stringify(res, null, 2));
})();