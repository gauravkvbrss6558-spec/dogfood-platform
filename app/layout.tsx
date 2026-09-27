import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import ChromeWrapper from "@/components/ChromeWrapper";

export const metadata: Metadata = {
  title: "Dogfood Platform",
  description: "Self-hostable hackathon submission and judging platform"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <ChromeWrapper>{children}</ChromeWrapper>
        </Providers>
      </body>
    </html>
  );
}
