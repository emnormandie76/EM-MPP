import { Bone, BoneCard, BoneRows, LoadingPage } from "@/components/ui/Skeleton";

/** Skeleton of /classement: the title, the season tabs, then the rows of the standings. */
export default function StandingsLoading() {
  return (
    <LoadingPage label="Chargement du classement…">
      <Bone className="h-11 w-72 max-w-full" />
      <Bone className="h-10 w-80 max-w-full" />
      <BoneCard className="flex flex-col gap-1">
        <Bone className="mb-2 h-5 w-96 max-w-full" />
        <BoneRows count={8} />
      </BoneCard>
    </LoadingPage>
  );
}
