# 🗺️📸 Route Scanner

This is a personal project combining my passion as a Velokurier for Öpfelchasper and innovative software application. A Blog Post on the project is available [here](https://cvonholly.cc/blog/oepfelchasper-tracker/).

A lightweight, serverless web application that allows users to snap a photo of a printed list of addresses and instantly generate an ordered, multi-stop Google Maps route. 

Built to solve the "printed delivery list" problem, this app runs entirely in the mobile browser, uses AI to perfectly parse messy OCR data, and automatically batches routes if they exceed Google Maps' limits.

## ✨ Features
* **No App Installation:** Runs entirely in the mobile browser (iOS Safari, Android Chrome).
* **Native Camera Integration:** Instantly opens the rear camera to scan paper lists.
* **Intelligent Parsing:** Uses Google Gemini to filter out headers, page numbers, and coffee stains, extracting *only* the real addresses.
* **Automatic Batching:** Google Maps limits URLs to 10 stops. If you scan 25 addresses, the app automatically generates seamless, overlapping route buttons (Part 1, Part 2, Part 3) so drivers never lose their place.
* **Single-File Architecture:** The frontend HTML/JS and the secure backend API are served from a single, blazing-fast Cloudflare Worker.

## 🛠️ Tech Stack
* **Hosting / Backend:** [Cloudflare Workers](https://workers.cloudflare.com/)
* **OCR (Text Extraction):** [Google Cloud Vision API](https://cloud.google.com/vision)
* **LLM (Text Parsing):** [Google Gemini 2.5 Flash API](https://aistudio.google.com/)
* **Routing:** Google Maps Universal Directions URLs
* **Frontend:** Vanilla HTML, CSS, and JavaScript

## 📋 Prerequisites
Before running or deploying this project, you will need:
1. [Node.js](https://nodejs.org/) installed on your machine.
2. A free [Cloudflare](https://dash.cloudflare.com/sign-up) account.
3. A **Google Cloud Vision API Key** (Billing must be enabled on your Google Cloud project).
4. A **Google Gemini API Key** (Available via Google AI Studio).

## 🚀 Local Development Setup

1. **Initialize the project folder:**
   Ensure your `worker.js` file is in your project directory.

2. **Set up local environment variables:**
   Create a file named exactly `.dev.vars` in the same directory as your `worker.js`. Add your API keys:
   ```env
   GOOGLE_VISION_API_KEY=your_vision_key_here
   GEMINI_API_KEY=your_gemini_key_here