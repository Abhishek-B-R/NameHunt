import { checkSquarespace } from "./providers/squarespace";

(async () => {
  const domain = process.argv[2] || "abhishek.tech";
  const res = await checkSquarespace(domain, {
    headless: false,
    ephemeralProfile: true,
  });
  console.log(JSON.stringify(res, null, 2));
})();