import { Bone, BoneCard, BoneRows, LoadingPage } from "@/components/ui/Skeleton";

// The home page in its own route group: this skeleton only shows while the home page loads, not
// the other game pages (a loading file covers every page below it).

export default function HomeLoading() {
  return (
    <LoadingPage label="Chargement de l'accueil…">
      <div className="flex flex-col gap-4 lg:flex-row">
        <BoneCard className="flex grow flex-col gap-3">
          <Bone className="h-11 w-72 max-w-full" />
          <Bone className="h-5 w-96 max-w-full" />
          <Bone className="h-2.5 w-full max-w-md" />
        </BoneCard>
        <div className="grid grid-cols-2 gap-4 lg:flex">
          <BoneCard className="h-34 lg:w-50" />
          <BoneCard className="h-34 lg:w-50" />
          <BoneCard className="h-34 lg:w-50" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="flex flex-col gap-2.5 lg:col-span-8">
          <Bone className="h-7 w-60" />
          <BoneCard className="h-40" />
          <BoneCard className="h-40" />
          <BoneCard className="h-40" />
        </div>
        <BoneCard className="flex flex-col gap-2 self-start lg:col-span-4">
          <Bone className="h-7 w-40" />
          <BoneRows count={6} />
        </BoneCard>
      </div>
    </LoadingPage>
  );
}
