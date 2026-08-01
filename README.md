# AsyncAds Publisher Dashboard

The publisher-facing dashboard for managing placements, promotions, offers, reports, payments, account settings, and integrations.

## Tech stack

- React and TypeScript
- Vite
- Redux Toolkit
- React Router
- Tailwind CSS
- Axios
- Recharts

## Getting started

Install the dependencies:

```bash
npm install
```

Create a `.env.local` file and provide the environment-specific values:

```env
VITE_API_URL=YOUR_API_URL_HERE
VITE_AUTH_URL=YOUR_AUTH_URL_HERE
VITE_PLAY_PROXY=YOUR_PLAY_PROXY_URL_HERE
```

The variables are used as follows:

- `VITE_API_URL`: base URL for dashboard API requests.
- `VITE_AUTH_URL`: base URL for publisher authentication requests.
- `VITE_PLAY_PROXY`: endpoint used for Google Play searches.

Do not commit real credentials, tokens, or private environment values. The committed `.env` and `.env.production` files contain placeholders only.

Start the development server:

```bash
npm run dev
```

## Demo access

Email:

```text
YOUR_DEMO_EMAIL_HERE
```

Password:

```text
YOUR_DEMO_PASSWORD_HERE
```

## Available commands

```bash
npm run dev      # Start the Vite development server
npm run build    # Type-check and create a production build
npm run lint     # Run ESLint
npm run preview  # Preview the production build locally
```

## Production build

Set the three Vite environment variables through the deployment environment, then run:

```bash
npm run build
```

The production output is generated in `dist/`.

## Source structure

```text
src/
|-- components/  Shared UI components
|-- lib/         API, authentication, and utility modules
|-- pages/       Dashboard routes and screens
|-- store/       Redux state and cached data
|-- App.tsx      Application routes
`-- main.tsx     Application entry point
```
