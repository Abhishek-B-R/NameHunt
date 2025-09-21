# 🌐 NameHunt

NameHunt helps you find the best place to buy a domain name.
Just type a domain (with TLD), and we’ll fetch prices from multiple domain registrars, sort them in order as per your preferences, and let you decide your best place to buy it.

## 🚀 Features

* 🔎 Search any domain with TLD (e.g. example.com, myproject.dev)

* 📊 Compare domain prices across multiple registrars

* 🏷️ Sorted results — sort based on your preferences

* ⚡ Fast lookups powered by APIs, and headless scraping

* 📱 Clean UI with Next.js frontend

* 🚀 Open multiple registrar websites via clicking a single button, these opened websites show the exact pricing of the domain that was entered in NameHunt  

## 🛠️ Tech Stack

Frontend: Next.js + Tailwind CSS + Bun

Backend: Hono (running on Pnpm runtime)

HTTP Fetching (will try next approach if one fails):

* Registrar APIs (preferred when available)

* Playwright (as a fallback when no API exists, by scraping registrar sites)

## ⚙️ Approach

Here’s how NameHunt fetches data:
```
User inputs domain → Backend pipeline begins 
    ↓
Try official registrar APIs (fastest + reliable)
    ↓
If unavailable, fallback to Playwright for scraping
    ↓
Aggregate all prices → Return to frontend
```


This layered approach makes it robust (works for most registrars) and flexible (easy to extend by adding new providers).

```
📂 Project Structure
namehunt/
├── frontend/                # Next.js frontend
├── backend/                 # Hono backend (Bun runtime)
│── .github/workflows        # CI-CD pipelines logic
│── README.md

```
## 🔧 Installation

### Clone the repo:

```bash
git clone https://github.com/your-username/namehunt.git
cd namehunt
```

Install dependencies: (use 2 different terminals)
```bash
cd frontend && bun install    # (for frontend)
cd backend && pnpm install    # (for backend)
```

Run development servers: (use 2 different terminals)
```bash
cd frontend
bun dev

# Backend
cd backend
docker-compose up --build
```

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit PRs.

⚡ Made with ❤️ by Abhishek