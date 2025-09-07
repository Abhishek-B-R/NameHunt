import { checkDomainSpaceship } from "./providers/spaceship.js";

(async () => {
  const domain = process.argv[2] || "abhishekbr.com";
  const res = await checkDomainSpaceship(domain, {
    headless: false,
    ephemeralProfile: true,
  });
  console.log(JSON.stringify(res, null, 2));
})();