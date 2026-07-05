import { SkeletonRows } from '../../components/Skeletons';

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-10">
      <div className="flex items-center justify-between gap-4 mb-10">
        <div className="h-9 w-24 rounded-xl skeleton" />
        <div className="h-9 w-72 rounded-xl skeleton" />
      </div>
      <SkeletonRows count={6} />
    </div>
  );
}
