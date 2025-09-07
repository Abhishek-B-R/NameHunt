import { checkDomainHover } from "./providers/hover.js";

(async () => {
  const domain = process.argv[2] || "abhishekbr.com";
  const res = await checkDomainHover(domain, {
    headless: false,
    ephemeralProfile: true,
  });
  console.log(JSON.stringify(res, null, 2));
})();