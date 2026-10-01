import { Bone, BoneCard, LoadingPage } from "@/components/ui/Skeleton";

/** Skeleton of a question page: chips, title and source, then the prediction or the results. */
export default function QuestionLoading() {
  return (
    <LoadingPage label="Chargement de la question…">
      <div className="flex flex-col gap-2">
        <Bone className="h-6 w-48" />
        <Bone className="h-9 w-full max-w-3xl" />
        <Bone className="h-5 w-72 max-w-full" />
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <BoneCard className="flex flex-col gap-3">
          <Bone className="h-5 w-32" />
          <Bone className="h-15.5 w-full" />
          <Bone className="h-12 w-full" />
        </BoneCard>
        <BoneCard className="flex flex-col gap-3">
          <Bone className="h-5 w-40" />
          <Bone className="h-24 w-full" />
        </BoneCard>
      </div>
    </LoadingPage>
  );
}
