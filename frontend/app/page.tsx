"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ThemeToggle } from "@/components/theme-toggle"
import { Search, DollarSign, Clock, Github, ExternalLink, Mail, CheckCircle } from "lucide-react"
import { useState } from "react"

export default function HomePage() {
  const [email, setEmail] = useState("")
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        setIsSubmitted(true)
        setEmail("")
      } else {
        const data = await response.json()
        setError(data.error || "Failed to join waitlist")
      }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      setError("Network error. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <Search className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold font-serif text-foreground">NameHunt</h1>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#about" className="text-muted-foreground hover:text-foreground transition-colors">
              About
            </a>
            <a
              href="https://github.com/Abhishek-B-R/namehunt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              GitHub
            </a>
            <ThemeToggle />
          </nav>
          <div className="md:hidden">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-muted/30 to-background">
        <div className="container mx-auto text-center max-w-4xl">
          <h2 className="text-5xl md:text-6xl font-black font-serif text-foreground mb-6 leading-tight">
            Find Your Perfect Domain at the <span className="text-primary">Best Price</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
            Compare prices across multiple registrars instantly. Save money and time with NameHunt - your domain search
            companion.
          </p>

          {!isSubmitted ? (
            <form
              onSubmit={handleWaitlistSubmit}
              className="flex flex-col sm:flex-row gap-4 justify-center items-center max-w-md mx-auto"
            >
              <div className="flex-1 w-full">
                <Input
                  type="email"
                  placeholder="Enter your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="text-lg px-4 py-6 bg-background border-border"
                />
                {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
              </div>
              <Button
                type="submit"
                size="lg"
                className="text-lg px-8 py-6 font-semibold whitespace-nowrap"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="w-5 h-5 mr-2 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Joining...
                  </>
                ) : (
                  <>
                    <Mail className="w-5 h-5 mr-2" />
                    Join Waitlist
                  </>
                )}
              </Button>
            </form>
          ) : (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 max-w-md mx-auto">
              <div className="flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">You&apos;re on the list!</h3>
              <p className="text-muted-foreground">
                We&apos;ll notify you as soon as NameHunt launches. Get ready to find the best domain deals!
              </p>
            </div>
          )}

          <div className="mt-6">
            <Button variant="outline" size="lg" className="text-lg px-8 py-6 bg-transparent" asChild>
              <a href="https://github.com/Abhishek-B-R/namehunt" target="_blank" rel="noopener noreferrer">
                <Github className="w-5 h-5 mr-2" />
                View on GitHub
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Development Countdown */}
      <section className="py-16 px-4 bg-card/30">
        <div className="container mx-auto text-center max-w-3xl">
          <div className="inline-flex items-center gap-2 bg-accent text-accent-foreground px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Clock className="w-4 h-4" />
            Currently Under Development
          </div>
          <h3 className="text-3xl font-bold font-serif text-foreground mb-4">We&apos;re Launching Soon!</h3>
          <p className="text-lg text-muted-foreground mb-8">
            NameHunt is being crafted with care. Follow our development journey and be the first to know when we launch.
          </p>
          <div className="mt-8">
            <Button variant="outline" asChild>
              <a href="https://github.com/Abhishek-B-R/namehunt" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Monitor Development Progress
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-16">
            <h3 className="text-4xl font-bold font-serif text-foreground mb-4">Why Choose NameHunt?</h3>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Stop getting ripped off on Day 1 of your new project. NameHunt makes domain buying simple, transparent,
              and affordable.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="border-border hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <Search className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="font-serif">Compare Prices Instantly</CardTitle>
                <CardDescription>
                  Scan across multiple registrars in real-time to find the best deals available.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center mb-4">
                  <DollarSign className="w-6 h-6 text-accent" />
                </div>
                <CardTitle className="font-serif">Save Money</CardTitle>
                <CardDescription>
                  No more hidden fees or price surprises. See transparent pricing from all major registrars.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-border hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center mb-4">
                  <Clock className="w-6 h-6 text-secondary" />
                </div>
                <CardTitle className="font-serif">Launch Faster</CardTitle>
                <CardDescription>
                  Stop wasting time comparing prices manually. Get the best deal in seconds and focus on building.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-4xl text-center">
          <h3 className="text-4xl font-bold font-serif text-foreground mb-6">The Domain Buying Problem</h3>
          <div className="text-lg text-muted-foreground space-y-4 leading-relaxed">
            <p>
              If you&apos;ve ever tried buying a domain, you know the frustration: prices vary wildly across registrars,
              hidden fees pop up everywhere, and finding the cheapest available option is a complete headache.
            </p>
            <p>
              <strong className="text-foreground">Why is this important?</strong> Because buying a domain is often the
              first step to launching something new - and no one likes getting ripped off on Day 1.
            </p>
            <p>With NameHunt, you save time, save money, and launch faster. It&apos;s that simple.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="github" className="py-12 px-4 bg-card border-t border-border">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
              <Search className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-bold font-serif">NameHunt</span>
          </div>
          <p className="text-muted-foreground mb-6">Making domain buying simple, transparent, and affordable.</p>
          <div className="flex justify-center space-x-6">
            <a
              href="https://github.com/Abhishek-B-R/namehunt"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <Github className="w-5 h-5" />
              <span>Contribute on GitHub</span>
            </a>
          </div>
          <div className="mt-8 pt-8 border-t border-border text-sm text-muted-foreground">
            <p>&copy; 2025 NameHunt. Built with passion for better domain searching.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
