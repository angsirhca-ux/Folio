"use client";

import { SceneCard } from "@/components/Storyboard/SceneCard";
import type { Scene, StoryboardZoom } from "@/lib/types";

export function DragOverlayCard({
  scene,
  zoom,
}: {
  scene: Scene;
  zoom: StoryboardZoom;
}) {
  return (
    <div className="w-[16rem] rotate-[1.5deg] scale-[1.03] sm:w-[18rem]">
      <SceneCard
        scene={scene}
        chapterId=""
        zoom={zoom}
        overlay
        onUpdateTitle={() => {}}
        onDuplicate={() => {}}
        onDelete={() => {}}
        onMove={() => {}}
        onConvertToChapter={() => {}}
        onStatusChange={() => {}}
      />
    </div>
  );
}
