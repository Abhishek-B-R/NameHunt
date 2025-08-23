import axios from "axios";
import { SquarespaceQuote } from "../types/squarespace";

async function getToken() {
  const resp = await axios.post(
    `${process.env.SQSP_RESELLER_BASE_URL}/oauth2/token`,
    new URLSearchParams({
      grant_type: "client_credentials",
      scope: process.env.SQSP_RESELLER_SCOPE ?? "",
    }),
    {
      auth: {
        username: process.env.SQSP_RESELLER_CLIENT_ID!,
        password: process.env.SQSP_RESELLER_CLIENT_SECRET!,
      },
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );
  return resp.data.access_token as string;
}

export async function checkDomainSquarespace(domain: string) {
  try {
    const token = await getToken();

    // endpoint paths are illustrative, replace with partner docs
    const resp = await axios.get(
      `${process.env.SQSP_RESELLER_BASE_URL}/domains/quote`,
      {
        headers: { Authorization: `Bearer ${token}` },
        params: { domain, action: "REGISTER" },
      }
    );

    const parsed = SquarespaceQuote.parse(resp.data);
    console.log("Squarespace Response:", parsed);
    return parsed;
  } catch (error: any) {
    if (error.response) {
      console.error("API Error:", error.response.status, error.response.data);
    } else {
      console.error("Error:", error.message);
    }
  }
}

// Usage
checkDomainSquarespace("abhishek.tech");
