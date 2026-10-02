import { Bone, BoneCard, LoadingPage } from "@/components/ui/Skeleton";

/** Skeleton of /chat: the title, then the thread and the message field. */
export default function ChatLoading() {
  return (
    <LoadingPage label="Chargement du chat…">
      <div className="flex flex-col gap-2">
        <Bone className="h-11 w-40" />
        <Bone className="h-5 w-full max-w-xl" />
      </div>
      <BoneCard className="flex flex-col gap-5">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="flex items-start gap-3">
            <Bone className="size-8 shrink-0 rounded-full" />
            <div className="flex grow flex-col gap-2">
              <Bone className="h-4 w-32" />
              <Bone className="h-5 w-full max-w-md" />
            </div>
          </div>
        ))}
        <Bone className="h-16 w-full" />
      </BoneCard>
    </LoadingPage>
  );
}
