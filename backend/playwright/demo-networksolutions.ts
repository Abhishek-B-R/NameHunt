import { checkDomainCom } from "./providers/networksolutions";

(async () => {
  const domain = process.argv[2] || "abhishek.tech";
  const res = await checkDomainCom(domain, {
    headless: false,
    ephemeralProfile: true,
  });
  console.log(JSON.stringify(res, null, 2));
})();