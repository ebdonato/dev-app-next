import type { Metadata } from "next";
import Link from "next/link";
import { FeedbackProvider } from "@/components/feedback/feedback-provider";
import { FeedbackRegion } from "@/components/feedback/feedback-region";
import { TRPCReactProvider } from "@/trpc/client";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "Task Manager",
  description: "A simple task manager built with Next.js and tRPC.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <TRPCReactProvider>
          <FeedbackProvider>
            <header className={styles.header}>
              <nav className={styles.nav}>
                <Link href="/" className={styles.brand}>
                  Task Manager
                </Link>
                <Link href="/tasks/new" className="button">
                  New task
                </Link>
              </nav>
            </header>
            <FeedbackRegion />
            <main className={styles.main}>{children}</main>
          </FeedbackProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
