import { checkDomainIONOS } from "./providers/ionoscom";

(async () => {
  const domain = process.argv[2] || "abhishek.tech";
  const res = await checkDomainIONOS(domain, {
    headless: false,
    ephemeralProfile: true,
  });
  console.log(JSON.stringify(res, null, 2));
})();