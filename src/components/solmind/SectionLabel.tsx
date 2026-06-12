type SectionLabelProps = {
    children: React.ReactNode;
  };
  
  export function SectionLabel({ children }: SectionLabelProps) {
    return (
      <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">
        {children}
      </p>
    );
  }