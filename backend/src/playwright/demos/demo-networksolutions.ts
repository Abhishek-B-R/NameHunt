import { checkNetworkSolutions } from "../providers/networksolutions.js";

(async () => {
  const domain = process.argv[2] || "abhishek.tech";
  const res = await checkNetworkSolutions(domain, {
    headless: false,
    ephemeralProfile: true,
  });
  console.log(JSON.stringify(res, null, 2));
})();