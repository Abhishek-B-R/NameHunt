import { HostingerDomains } from "./hostinger";

async function run() {
  const domain = "abhishek.tech";

  const h = new HostingerDomains(); // reads env

  try {
    const avail = await h.availability(domain);
    console.log("Availability:", avail);

    if (!avail.available) {
      console.log("Domain not available");
      return;
    }

    const quote = await h.quote(domain, "REGISTER");
    console.log("Quote:", quote);
  } catch (e: any) {
    if (e.response) {
      console.error("API Error:", e.response.status, e.response.data);
    } else {
      console.error("Error:", e.message);
    }
  }
}

run();