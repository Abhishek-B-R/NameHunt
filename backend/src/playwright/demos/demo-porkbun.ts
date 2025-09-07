import { checkDomainPorkbun } from "../providers/porkbun.js";

(async () => {
  const domain = process.argv[2] || "abhishek.tech";
  const res = await checkDomainPorkbun(domain, {
    headless: false,
    ephemeralProfile: true,
  });
  console.log(JSON.stringify(res, null, 2));
})();