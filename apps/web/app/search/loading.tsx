import { SkeletonGrid } from '../../components/Skeletons';

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-12">
      <div className="h-4 w-20 rounded skeleton" />
      <div className="mt-3 mb-10 flex gap-3 max-w-xl">
        <div className="h-11 grow rounded-xl skeleton" />
        <div className="h-11 w-24 rounded-xl skeleton" />
      </div>
      <div className="h-5 w-40 rounded skeleton mb-4" />
      <SkeletonGrid count={8} />
    </div>
  );
}
