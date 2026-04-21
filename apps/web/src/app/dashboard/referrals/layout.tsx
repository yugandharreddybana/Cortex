export default function ReferralsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col h-full bg-bg text-white overflow-hidden relative">
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
