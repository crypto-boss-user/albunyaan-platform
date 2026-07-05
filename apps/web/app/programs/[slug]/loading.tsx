export default function Loading() {
  return (
    <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-12">
      <div className="grid lg:grid-cols-[1.2fr_1fr] gap-10 items-start">
        <div className="aspect-video rounded-2xl skeleton" />
        <div>
          <div className="h-4 w-24 rounded skeleton" />
          <div className="h-9 w-4/5 rounded skeleton mt-4" />
          <div className="h-4 w-40 rounded skeleton mt-5" />
          <div className="h-24 w-full rounded skeleton mt-6" />
          <div className="h-12 w-44 rounded-full skeleton mt-8" />
        </div>
      </div>
    </div>
  );
}
