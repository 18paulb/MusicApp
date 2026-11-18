import type { Metadata } from "next";
import "./globals.css";

const title = "that's life";
const description = "Brandon Paul — that's life";
const siteUrl = "https://music-app-beige-six.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  openGraph: {
    title,
    description,
    images: ["/images/albumcover.JPG"],
    url: "/",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/images/albumcover.JPG"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
