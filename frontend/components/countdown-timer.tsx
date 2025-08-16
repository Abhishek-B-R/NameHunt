"use client"

import { useState, useEffect } from "react"

export function CountdownTimer() {
  const [timeLeft, setTimeLeft] = useState({
    days: 10,
    hours: 0,
    minutes: 0,
    seconds: 0,
  })

  useEffect(() => {
    // Set target date to 10 days from now
    const targetDate = new Date()
    targetDate.setDate(targetDate.getDate() + 10)

    const timer = setInterval(() => {
      const now = new Date().getTime()
      const distance = targetDate.getTime() - now

      if (distance > 0) {
        const days = Math.floor(distance / (1000 * 60 * 60 * 24))
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60))
        const seconds = Math.floor((distance % (1000 * 60)) / 1000)

        setTimeLeft({ days, hours, minutes, seconds })
      }
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  return (
    <div className="flex gap-4 justify-center">
      {Object.entries(timeLeft).map(([unit, value]) => (
        <div key={unit} className="text-center">
          <div className="bg-primary text-primary-foreground rounded-lg p-4 min-w-16">
            <div className="text-2xl font-bold font-serif">{value.toString().padStart(2, "0")}</div>
          </div>
          <div className="text-sm text-muted-foreground mt-2 capitalize">{unit}</div>
        </div>
      ))}
    </div>
  )
}
