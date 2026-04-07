import "./globals.css";

export const metadata = {
  title: "OutMate – NLP Enrichment Demo",
  description: "Type any natural language prompt to find and enrich B2B companies or prospects via Explorium.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
