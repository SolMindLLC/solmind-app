type PageShellProps = {
    children: React.ReactNode;
    maxWidth?: "3xl" | "5xl" | "6xl";
  };
  
  const maxWidthClasses = {
    "3xl": "max-w-3xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
  };
  
  export function PageShell({ children, maxWidth = "6xl" }: PageShellProps) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-50">
        <section className={`mx-auto ${maxWidthClasses[maxWidth]}`}>
          {children}
        </section>
      </main>
    );
  }