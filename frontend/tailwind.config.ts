import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./providers/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        "outage-black": "#080A0F",
        "rack-grey": "#151923",
        "panel-graphite": "#1D2430",
        "signal-green": "#38FCA6",
        "incident-amber": "#FFB020",
        "failure-red": "#FF4D5E",
        "consensus-violet": "#8B5CF6",
        "protocol-blue": "#38BDF8",
        "panel-white": "#EAF0F6",
        "muted-steel": "#7C8798",
      },
      fontFamily: {
        heading: ["Space Grotesk", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
        label: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
