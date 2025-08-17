import axios from "axios";
import GoDaddyResponse from "../../zod-types/types/godaddy";

async function checkDomain(domain: string, period: number) {
  try {
    const response = await axios.get(
      `https://api.ote-godaddy.com/v1/domains/available?domain=${domain}&checkType=FULL&period=${period}`,
      {
        headers: {
          Authorization: `sso-key ${process.env.GODADDY_API_KEY}:${process.env.GODADDY_API_SECRET}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      }
    );

    const parsed = GoDaddyResponse.parse(response.data);
    if ("price" in parsed) {
      parsed.price = parsed.price / 1_000_000;
    }
    console.log("Response:", parsed);
    return parsed;
  } catch (error: any) {
    if (error.response) {
      console.error("API Error:", error.response.status, error.response.data);
    } else {
      console.error("Error:", error.message);
    }
  }
}

checkDomain("abhishek.tech", 1);
