"use client";

// Error boundaries must be client components. Error details are not shown to
// the user; they are logged by Next.js on the server.
export default function ErrorPage({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <section>
      <h1>Something went wrong.</h1>
      <button type="button" className="button" onClick={reset}>
        Try again
      </button>
    </section>
  );
}
