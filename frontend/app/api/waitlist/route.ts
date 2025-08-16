import { type NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Valid email address is required" }, { status: 400 })
    }

    await prisma.waitlist.upsert({
      where: { email },
      update: {},
      create: { email },
    })

    return NextResponse.json({ message: "Successfully added to waitlist" }, { status: 200 })
  } catch (error) {
    console.error("Error adding to waitlist:", error)
    return NextResponse.json({ error: "Failed to add to waitlist" }, { status: 500 })
  }
}
