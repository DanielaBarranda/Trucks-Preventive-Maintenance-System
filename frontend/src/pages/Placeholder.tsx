// Temporary page used until the real screens land (Tasks 4–6)
export function Placeholder({ testId, title }: { testId: string; title: string }) {
  return (
    <main data-testid={testId} className="p-8">
      <h1 className="text-2xl font-bold text-blue-700">{title}</h1>
    </main>
  );
}
