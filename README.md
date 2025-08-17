# 🌐 NameHunt

NameHunt helps you find the cheapest place to buy a domain name.
Just type a domain (with TLD), and we’ll fetch prices from multiple domain registrars, sort them in ascending order, and show you where it’s cheapest to buy.

## 🚀 Features

* 🔎 Search any domain with TLD (e.g. example.com, myproject.dev)

* 📊 Compare domain prices across multiple registrars

* 🏷️ Sorted results — cheapest registrar at the top

* ⚡ Fast lookups powered by APIs, curl, and headless scraping

* 📱 Clean UI with Next.js frontend

## 🛠️ Tech Stack

Frontend: Next.js + Tailwind CSS

Backend: Hono (running on Bun runtime)

HTTP Fetching (will try next approach if one fails):

* Registrar APIs (preferred when available)

* curl via child processes (for fast/quirky endpoints)

* Puppeteer (as a fallback when no API exists, by scraping registrar sites)

## ⚙️ Approach

Here’s how NameHunt fetches data:
```
User inputs domain → Backend pipeline begins 
    ↓
Try official registrar APIs (fastest + reliable)
    ↓
If unavailable, spawn `curl` processes for HTTP calls
    ↓
If still unavailable, fallback to Puppeteer for scraping
    ↓
Aggregate all prices → Sort ascending → Return to frontend
```


This layered approach makes it robust (works for most registrars) and flexible (easy to extend by adding new providers).

```
📂 Project Structure
namehunt/
│── apps/
│    ├── web/         # Next.js frontend
│    └── server/      # Hono backend (Bun runtime)
│
│── packages/         # Shared utils and configs
│── README.md

```
## 🔧 Installation

### Clone the repo:

```bash
git clone https://github.com/your-username/namehunt.git
cd namehunt
```

Install dependencies:
```bash
bun install
```

Run development servers:
```bash
# Frontend
cd apps/web
bun dev

# Backend
cd apps/server
bun dev
```

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit PRs.

⚡ Made with ❤️ by Abhishek