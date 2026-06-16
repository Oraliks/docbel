export default function FormationsLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="glass-surface h-56 animate-pulse rounded-3xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass-surface h-56 animate-pulse rounded-3xl" />
        ))}
      </div>
    </div>
  );
}
