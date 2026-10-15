"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ConfirmButton } from "@/components/confirm-button";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/use-action";
import { cn } from "@/lib/utils";
import { deletePhoto, reorderPhotos } from "./actions";

const MAX_SIDE = 1600;
const MAX_PHOTOS = 12;

/** Shrinks a photo to at most 1600px on its long side as a JPEG, respecting the camera's rotation. */
async function resize(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("Couldn't process the photo");
  return { blob, width, height };
}

export function PhotosForm({
  weddingId,
  photos,
  editable,
}: {
  weddingId: string;
  photos: { id: string }[];
  editable: boolean;
}) {
  const router = useRouter();
  const { run } = useAction();
  const [uploading, setUploading] = useState(0);
  // Shown order; follows the server's whenever the photo list changes (uploads, deletes, saves).
  const [order, setOrder] = useState(photos.map((p) => p.id));
  const [synced, setSynced] = useState(photos);
  if (synced !== photos) {
    setSynced(photos);
    setOrder(photos.map((p) => p.id));
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // On phones, press and hold to pick a photo up, so the page still scrolls normally.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const before = order;
    const next = arrayMove(order, order.indexOf(String(active.id)), order.indexOf(String(over.id)));
    setOrder(next);
    const saved = await run(
      () => reorderPhotos(weddingId, next),
      next[0] !== before[0] ? "Cover photo updated" : undefined,
    );
    if (!saved) setOrder(before);
  }

  async function upload(files: File[]) {
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room)
      toast.error(`You can add up to ${MAX_PHOTOS} photos, so only the first ${Math.max(room, 0)} were added.`);
    const batch = files.slice(0, Math.max(room, 0));
    setUploading(batch.length);
    for (const file of batch) {
      try {
        const { blob, width, height } = await resize(file);
        const form = new FormData();
        form.set("file", blob, "photo.jpg");
        form.set("width", String(width));
        form.set("height", String(height));
        const res = await fetch(`/w/${weddingId}/photos`, { method: "POST", body: form });
        const result = (await res.json().catch(() => null)) as { ok: boolean; error?: string } | null;
        if (!result?.ok) toast.error(result?.error ?? `Couldn't upload ${file.name}`);
      } catch {
        toast.error(`Couldn't read ${file.name}. Try a JPEG or PNG.`);
      }
      setUploading((n) => n - 1);
    }
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {photos.length > 0 ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={order} strategy={rectSortingStrategy} disabled={!editable}>
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {order.map((id, i) => (
                <SortablePhoto
                  key={id}
                  id={id}
                  src={`/w/${weddingId}/photos/${id}`}
                  index={i}
                  editable={editable}
                  onDelete={() => run(() => deletePhoto(weddingId, id), "Photo removed")}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      ) : (
        <p className="text-sm text-muted-foreground">
          No photos yet. Your first photo becomes the cover at the top of your guest page; the rest show in a gallery.
        </p>
      )}
      {editable && photos.length > 1 && (
        <p className="text-xs text-muted-foreground">Drag photos to reorder them. The first one is the cover.</p>
      )}
      {editable && photos.length < MAX_PHOTOS && (
        <Button asChild variant="outline" disabled={uploading > 0}>
          <label className="cursor-pointer">
            {uploading > 0 ? <Loader2 className="animate-spin" /> : <ImagePlus />}
            {uploading > 0 ? `Uploading ${uploading}…` : "Add photos"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={uploading > 0}
              onChange={(e) => {
                upload(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
          </label>
        </Button>
      )}
    </div>
  );
}

function SortablePhoto({
  id,
  src,
  index,
  editable,
  onDelete,
}: {
  id: string;
  src: string;
  index: number;
  editable: boolean;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("group relative touch-manipulation", isDragging && "z-10 opacity-80 shadow-xl")}
    >
      <div
        {...(editable ? { ...attributes, ...listeners } : {})}
        aria-label={editable ? `Photo ${index + 1}. Drag to reorder` : undefined}
        className={cn("rounded-xl", editable && "cursor-grab active:cursor-grabbing")}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- served from our own route, already resized */}
        <img
          src={src}
          alt={index === 0 ? "Cover photo" : `Photo ${index + 1}`}
          draggable={false}
          className="aspect-square w-full rounded-xl border object-cover select-none"
        />
      </div>
      {index === 0 && (
        <span className="pointer-events-none absolute top-2 left-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-semibold">
          Cover
        </span>
      )}
      {editable && (
        <>
          <GripVertical className="pointer-events-none absolute top-2 right-2 size-5 rounded bg-background/80 p-0.5 text-muted-foreground" />
          <div className="absolute right-2 bottom-2">
            <ConfirmButton
              title="Remove this photo?"
              description="It will no longer show on your guest page."
              onConfirm={onDelete}
            >
              <Button size="icon-sm" variant="outline" className="bg-background/90" aria-label="Remove photo">
                <Trash2 />
              </Button>
            </ConfirmButton>
          </div>
        </>
      )}
    </li>
  );
}
