import { SkeletonGrid } from '../../../components/Skeletons';

export default function Loading() {
  return (
    <div className="max-w-[1400px] mx-auto px-5 sm:px-8 py-12">
      <div className="h-4 w-24 rounded skeleton" />
      <div className="h-8 w-72 rounded skeleton mt-3 mb-10" />
      <SkeletonGrid count={12} />
    </div>
  );
}
