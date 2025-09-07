import { checkDomainNameCom } from "../providers/namecom.js";

(async () => {
  const domain = process.argv[2] || "abhishek.tech";
  const res = await checkDomainNameCom(domain, {
    headless: false,
    ephemeralProfile: true,
  });
  console.log(JSON.stringify(res, null, 2));
})();