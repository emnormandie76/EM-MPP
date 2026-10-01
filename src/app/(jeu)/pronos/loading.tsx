import { Bone, BoneCard, LoadingPage } from "@/components/ui/Skeleton";

/** Skeleton of /pronos: the title, the tabs, then one row per open question. */
export default function PronosLoading() {
  return (
    <LoadingPage label="Chargement de tes pronos…">
      <Bone className="h-11 w-64 max-w-full" />
      <Bone className="h-10 w-full max-w-xl" />
      {[0, 1, 2].map((index) => (
        <BoneCard key={index} className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="flex flex-col gap-2.5">
            <Bone className="h-6 w-40" />
            <Bone className="h-6 w-full" />
            <Bone className="h-5 w-48" />
          </div>
          <div className="flex flex-col gap-3">
            <Bone className="h-15.5 w-full" />
            <Bone className="h-12 w-full" />
          </div>
        </BoneCard>
      ))}
    </LoadingPage>
  );
}
