# Tea Diagnosis AI 🍵

AI-powered tea diagnosis application built with Next.js and OpenAI.

## Features

- **AI Tea Sommelier**: Chat with an AI that recommends teas based on your mood and preferences
- **Conversational Interface**: Natural conversation flow with typing animations
- **Context-Aware Suggestions**: AI provides personalized tea recommendations
- **Seasonal Greetings**: Time and season-based welcome messages

## Getting Started

### Prerequisites

- Node.js 20+ 
- pnpm (recommended) or npm
- OpenAI API key

### Installation

1. Clone the repository:
```bash
git clone https://github.com/temasamo/tea-diagnosis.git
cd tea-diagnosis
```

2. Install dependencies:
```bash
pnpm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Add your OpenAI API key to .env.local
```

4. Run the development server:
```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Usage

1. Visit `/tea/diagnosis` to start the tea diagnosis
2. Chat with the AI about your current mood or preferences
3. Receive personalized tea recommendations
4. The AI will ask follow-up questions to refine suggestions

## Technology Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Styling**: Inline CSS (for maximum compatibility)
- **AI**: OpenAI GPT API
- **Package Manager**: pnpm

## Deployment

This application is designed to be deployed on Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/temasamo/tea-diagnosis)

## License

MIT License - see [LICENSE](LICENSE) file for details.
