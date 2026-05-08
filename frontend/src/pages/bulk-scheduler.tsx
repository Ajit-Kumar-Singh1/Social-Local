import { useState, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { format, startOfDay } from "date-fns";
import {
  Plus, Trash2, Send, Loader2, AlertCircle, Type, Image as ImageIcon,
  Video, Sparkles, CalendarIcon, CheckCircle2, ArrowLeft, Upload, Link as LinkIcon, X,
} from "lucide-react";
import {
  useListPages, useGenerateImage, getListPostsQueryKey, getGetDashboardStatsQueryKey,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type PostType = "text" | "image" | "video";
type MediaMode = "ai" | "upload" | "url";

interface BulkRow {
  id: string;
  pageId: number;
  postType: PostType;
  mediaMode: MediaMode;
  title: string;
  caption: string;
  mediaPrompt: string;
  generating: boolean;
  mediaUrl: string;
  uploading: boolean;
  uploadedFileName: string;
  scheduledDate: string;
  scheduledTime: string;
}

const makeRow = (pageId = 0): BulkRow => ({
  id: Math.random().toString(36).slice(2),
  pageId,
  postType: "image",
  mediaMode: "ai",
  title: "",
  caption: "",
  mediaPrompt: "",
  generating: false,
  mediaUrl: "",
  uploading: false,
  uploadedFileName: "",
  scheduledDate: format(new Date(), "yyyy-MM-dd"),
  scheduledTime: format(new Date(Date.now() + 3600_000), "HH:mm"),
});

const POST_TYPE_OPTIONS: { value: PostType; label: string; icon: React.ElementType }[] = [
  { value: "text", label: "Text", icon: Type },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "video", label: "Video", icon: Video },
];

export function BulkScheduler() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: pages, isLoading: loadingPages } = useListPages();
  const generateImage = useGenerateImage();

  const [rows, setRows] = useState<BulkRow[]>([makeRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const updateRow = useCallback((id: string, patch: Partial<BulkRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const addRow = () => {
    const lastPageId = rows[rows.length - 1]?.pageId ?? 0;
    setRows((prev) => [...prev, makeRow(lastPageId)]);
  };

  const removeRow = (id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleGenerateImage = (row: BulkRow) => {
    if (!row.mediaPrompt.trim()) {
      toast({ title: "Prompt required", description: "Enter a prompt first.", variant: "destructive" });
      return;
    }
    updateRow(row.id, { generating: true });
    generateImage.mutate(
      { data: { prompt: row.mediaPrompt, style: "photorealistic" } },
      {
        onSuccess: (res) => {
          updateRow(row.id, { generating: false, mediaUrl: res.imageUrl });
          toast({ title: "Image generated!", description: "AI image attached to this row." });
        },
        onError: (err) => {
          updateRow(row.id, { generating: false });
          toast({ title: "Generation failed", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleFileUpload = async (row: BulkRow, file: File) => {
    updateRow(row.id, { uploading: true, uploadedFileName: file.name });
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Upload failed");
      }
      const data = await res.json() as { url: string; filename: string };
      updateRow(row.id, { uploading: false, mediaUrl: data.url, uploadedFileName: file.name });
      toast({ title: "File uploaded!", description: `${file.name} is ready.` });
    } catch (err) {
      updateRow(row.id, { uploading: false, uploadedFileName: "" });
      toast({ title: "Upload failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    }
  };

  const buildScheduledAt = (row: BulkRow): string | null => {
    if (!row.scheduledDate) return null;
    return new Date(`${row.scheduledDate}T${row.scheduledTime || "00:00"}`).toISOString();
  };

  const handleSubmit = async () => {
    const invalid = rows.filter((r) => !r.pageId || !r.caption.trim());
    if (invalid.length > 0) {
      toast({ title: "Missing fields", description: "Every row needs a Page and a Caption/Message.", variant: "destructive" });
      return;
    }
    const stillUploading = rows.find((r) => r.uploading);
    if (stillUploading) {
      toast({ title: "Upload in progress", description: "Wait for file uploads to finish.", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        posts: rows.map((r) => ({
          pageId: r.pageId,
          title: r.title || null,
          postType: r.postType,
          caption: r.caption,
          imageUrl: r.postType !== "text" ? (r.mediaUrl || null) : null,
          audioUrl: null,
          scheduledAt: buildScheduledAt(r),
        })),
      };

      const res = await fetch("/api/posts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Unknown error");
      }

      const created = (await res.json() as unknown[]).length;
      queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
      setSubmitted(true);
      toast({ title: `${created} post${created !== 1 ? "s" : ""} scheduled!` });
    } catch (err) {
      toast({ title: "Failed", description: err instanceof Error ? err.message : "Unknown error", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  if (!loadingPages && (!pages || pages.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card border border-border rounded-xl text-center animate-in fade-in duration-500">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold tracking-tight">No Pages Connected</h2>
        <p className="text-muted-foreground mt-2 max-w-md">Connect a Facebook page before scheduling posts.</p>
        <Button onClick={() => setLocation("/pages")} className="mt-6">Go to Pages</Button>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center animate-in fade-in duration-500">
        <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
        <h2 className="text-2xl font-bold tracking-tight">All Posts Scheduled!</h2>
        <p className="text-muted-foreground mt-2">They'll be published automatically at the times you set.</p>
        <div className="flex gap-3 mt-8">
          <Button variant="outline" onClick={() => { setRows([makeRow()]); setSubmitted(false); }}>Schedule More</Button>
          <Button onClick={() => setLocation("/posts")}>View Posts</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setLocation("/posts")} className="shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Bulk Scheduler</h1>
            <p className="text-muted-foreground mt-1">Add multiple posts at once — like filling in a spreadsheet.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={addRow} className="gap-2">
            <Plus className="h-4 w-4" /> Add Row
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || rows.length === 0} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Schedule {rows.length} Post{rows.length !== 1 ? "s" : ""}
          </Button>
        </div>
      </div>

      <div
        className="hidden xl:grid gap-2 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-widest"
        style={{ gridTemplateColumns: "2fr 90px 1.2fr 2fr 2.4fr 1.6fr 36px" }}
      >
        <span>Page</span>
        <span>Type</span>
        <span>Title</span>
        <span>Caption / Message</span>
        <span>Media</span>
        <span>Schedule (Date &amp; Time)</span>
        <span />
      </div>

      <div className="space-y-3">
        {rows.map((row, idx) => (
          <BulkRowComponent
            key={row.id}
            row={row}
            idx={idx}
            pages={pages ?? []}
            total={rows.length}
            onUpdate={(patch) => updateRow(row.id, patch)}
            onRemove={() => removeRow(row.id)}
            onGenerateImage={() => handleGenerateImage(row)}
            onFileUpload={(file) => handleFileUpload(row, file)}
          />
        ))}
      </div>

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={addRow} className="gap-2">
          <Plus className="h-4 w-4" /> Add Another Row
        </Button>
        <Button onClick={handleSubmit} disabled={submitting} size="lg" className="gap-2">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Schedule All {rows.length} Post{rows.length !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}

interface BulkRowProps {
  row: BulkRow;
  idx: number;
  pages: { id: number; name: string }[];
  total: number;
  onUpdate: (patch: Partial<BulkRow>) => void;
  onRemove: () => void;
  onGenerateImage: () => void;
  onFileUpload: (file: File) => void;
}

function BulkRowComponent({ row, idx, pages, total, onUpdate, onRemove, onGenerateImage, onFileUpload }: BulkRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mediaModes: { value: MediaMode; label: string; icon: React.ElementType }[] =
    row.postType === "image"
      ? [
          { value: "ai", label: "AI", icon: Sparkles },
          { value: "upload", label: "Upload", icon: Upload },
          { value: "url", label: "URL", icon: LinkIcon },
        ]
      : [
          { value: "upload", label: "Upload", icon: Upload },
          { value: "url", label: "URL", icon: LinkIcon },
        ];

  const currentMode = row.postType === "image" ? row.mediaMode : (row.mediaMode === "ai" ? "upload" : row.mediaMode);

  const acceptAttr = row.postType === "image"
    ? "image/jpeg,image/png,image/gif,image/webp"
    : "video/mp4,video/quicktime,video/avi,video/x-msvideo,video/x-matroska";

  return (
    <div
      className="bg-card border border-border rounded-xl p-4 space-y-3 xl:space-y-0 xl:grid xl:gap-2 xl:items-start"
      style={{ gridTemplateColumns: "2fr 90px 1.2fr 2fr 2.4fr 1.6fr 36px" }}
    >
      <div className="xl:hidden flex items-center gap-2 mb-1">
        <Badge variant="outline" className="text-xs">Row {idx + 1}</Badge>
      </div>

      <div className="space-y-1">
        <span className="xl:hidden text-xs text-muted-foreground font-medium">Page</span>
        <Select
          value={row.pageId ? row.pageId.toString() : ""}
          onValueChange={(val) => onUpdate({ pageId: parseInt(val, 10) })}
        >
          <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select page…" /></SelectTrigger>
          <SelectContent>
            {pages.map((p) => <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1">
        <span className="xl:hidden text-xs text-muted-foreground font-medium">Type</span>
        <div className="flex gap-1">
          {POST_TYPE_OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              title={label}
              onClick={() => onUpdate({ postType: value, mediaUrl: "", mediaPrompt: "", uploadedFileName: "" })}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 rounded-md border py-1.5 px-0.5 text-[10px] transition-all",
                row.postType === value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/40"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1">
        <span className="xl:hidden text-xs text-muted-foreground font-medium">Title</span>
        <Input
          className="h-9 text-sm"
          placeholder="Title (optional)"
          value={row.title}
          onChange={(e) => onUpdate({ title: e.target.value })}
        />
      </div>

      <div className="space-y-1">
        <span className="xl:hidden text-xs text-muted-foreground font-medium">Caption / Message</span>
        <Textarea
          className="text-sm min-h-[72px] resize-none"
          placeholder={row.postType === "text" ? "Your message…" : "Caption for media…"}
          value={row.caption}
          onChange={(e) => onUpdate({ caption: e.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <span className="xl:hidden text-xs text-muted-foreground font-medium">Media</span>

        {row.postType === "text" ? (
          <div className="h-9 flex items-center px-3 rounded-md border border-dashed text-xs text-muted-foreground">
            No media needed for text posts
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-1 border border-border rounded-lg p-0.5 bg-muted/40">
              {mediaModes.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => onUpdate({ mediaMode: value, mediaUrl: "", mediaPrompt: "", uploadedFileName: "" })}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 rounded-md py-1 px-1.5 text-xs font-medium transition-all",
                    currentMode === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>

            {currentMode === "ai" && row.postType === "image" && (
              <div className="space-y-1.5">
                <div className="flex gap-1.5">
                  <Input
                    className="h-8 text-sm flex-1"
                    placeholder="Describe the image to generate…"
                    value={row.mediaPrompt}
                    onChange={(e) => onUpdate({ mediaPrompt: e.target.value, mediaUrl: "" })}
                  />
                  <Button
                    type="button" size="sm" variant="secondary"
                    className="h-8 px-2 shrink-0 gap-1"
                    disabled={row.generating || !row.mediaPrompt.trim()}
                    onClick={onGenerateImage}
                    title="Generate with AI"
                  >
                    {row.generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                {row.mediaUrl && (
                  <div className="relative inline-block">
                    <img
                      src={row.mediaUrl}
                      alt="Generated"
                      className="h-14 w-auto rounded-md border border-border object-cover"
                      onError={(e) => (e.target as HTMLImageElement).classList.add("hidden")}
                    />
                    <button
                      type="button"
                      onClick={() => onUpdate({ mediaUrl: "", mediaPrompt: "" })}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentMode === "upload" && (
              <div className="space-y-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptAttr}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onFileUpload(file);
                    e.target.value = "";
                  }}
                />
                {row.mediaUrl ? (
                  <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md border border-border">
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    <span className="text-xs text-foreground truncate flex-1">{row.uploadedFileName || "Uploaded"}</span>
                    {row.postType === "image" && (
                      <img src={row.mediaUrl} alt="Preview" className="h-8 w-8 rounded object-cover shrink-0" onError={() => {}} />
                    )}
                    <button
                      type="button"
                      onClick={() => onUpdate({ mediaUrl: "", uploadedFileName: "" })}
                      className="text-muted-foreground hover:text-destructive shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={row.uploading}
                    className="w-full h-16 border-2 border-dashed border-border rounded-md flex flex-col items-center justify-center gap-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground transition-all"
                  >
                    {row.uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Uploading {row.uploadedFileName}…</span>
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        <span>Click to upload {row.postType === "image" ? "image" : "video"}</span>
                        <span className="text-[10px] opacity-60">
                          {row.postType === "image" ? "JPG, PNG, GIF, WebP" : "MP4, MOV, AVI up to 100 MB"}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {currentMode === "url" && (
              <div className="space-y-1.5">
                <Input
                  className="h-8 text-sm"
                  placeholder={row.postType === "image" ? "https://example.com/image.jpg" : "https://example.com/video.mp4"}
                  value={row.mediaUrl}
                  onChange={(e) => onUpdate({ mediaUrl: e.target.value })}
                />
                {row.postType === "image" && row.mediaUrl.startsWith("http") && (
                  <img
                    src={row.mediaUrl}
                    alt="Preview"
                    className="h-12 w-auto rounded-md border border-border object-cover"
                    onError={(e) => (e.target as HTMLImageElement).classList.add("hidden")}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-1">
        <span className="xl:hidden text-xs text-muted-foreground font-medium flex items-center gap-1">
          <CalendarIcon className="h-3 w-3" /> Schedule
        </span>
        <div className="space-y-1">
          <Input
            type="date"
            className="h-8 text-sm"
            min={format(startOfDay(new Date()), "yyyy-MM-dd")}
            value={row.scheduledDate}
            onChange={(e) => onUpdate({ scheduledDate: e.target.value })}
          />
          <Input
            type="time"
            className="h-8 text-sm"
            value={row.scheduledTime}
            onChange={(e) => onUpdate({ scheduledTime: e.target.value })}
          />
        </div>
      </div>

      <div className="flex items-start xl:justify-center pt-0.5">
        <Button
          type="button" variant="ghost" size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-destructive"
          disabled={total === 1}
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
