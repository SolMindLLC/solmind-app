type PanelProps = {
    children: React.ReactNode;
    className?: string;
  };
  
  export function Panel({ children, className = "" }: PanelProps) {
    return (
      <div
        className={`rounded-3xl border border-slate-800 bg-slate-900/60 p-8 ${className}`}
      >
        {children}
      </div>
    );
  }