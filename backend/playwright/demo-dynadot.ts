import { checkDynadot } from "./providers/dynadot";

(async () => {
  const domain = process.argv[2] || "abhishek.tech";
  const res = await checkDynadot(domain, {
    headless: false,
    ephemeralProfile: true,
  });
  console.log(JSON.stringify(res, null, 2));
})();