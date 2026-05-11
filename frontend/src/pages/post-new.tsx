import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, startOfDay } from "date-fns";
import {
  CalendarIcon, Loader2, Sparkles, Send, Clock, AlertCircle,
  Image as ImageIcon, Video, Type, Upload, X, ChevronDown,
} from "lucide-react";
import {
  useListPages, useCreatePost, useGenerateImage, useUploadFile,
  getListPostsQueryKey, getGetDashboardStatsQueryKey,
  type ImageProvider,
} from "@/lib/api-client";
import { useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type PostType = "text" | "image" | "video";

const PROVIDERS: Array<{
  value: ImageProvider;
  label: string;
  description: string;
  models: Array<{ value: string; label: string }>;
  envKey?: string;
}> = [
  {
    value: "pollinations",
    label: "Pollinations.ai",
    description: "Free, no API key needed",
    models: [{ value: "flux", label: "Flux (default)" }],
  },
  {
    value: "huggingface",
    label: "HuggingFace",
    description: "Requires HUGGING_FACE_API_KEY",
    envKey: "HUGGING_FACE_API_KEY",
    models: [
      { value: "stabilityai/stable-diffusion-xl-base-1.0", label: "SDXL (default)" },
      { value: "black-forest-labs/FLUX.1-schnell", label: "FLUX.1 Schnell" },
      { value: "runwayml/stable-diffusion-v1-5", label: "Stable Diffusion 1.5" },
    ],
  },
  {
    value: "openai",
    label: "OpenAI DALL-E",
    description: "Requires OPENAI_API_KEY",
    envKey: "OPENAI_API_KEY",
    models: [
      { value: "dall-e-3", label: "DALL-E 3 (default)" },
      { value: "dall-e-2", label: "DALL-E 2" },
    ],
  },
  {
    value: "gemini",
    label: "Google Gemini",
    description: "Requires GEMINI_API_KEY",
    envKey: "GEMINI_API_KEY",
    models: [
      { value: "gemini-2.0-flash-preview-image-generation", label: "Gemini 2.0 Flash Imagen (default)" },
    ],
  },
];

const formSchema = z.object({
  pageId: z.coerce.number().min(1, "Please select a Facebook page"),
  postType: z.enum(["text", "image", "video"]).default("image"),
  title: z.string().optional().or(z.literal("")),
  caption: z.string().min(1, "Caption is required").max(2200, "Caption is too long"),
  imageUrl: z.string().optional().or(z.literal("")),
  videoUrl: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  scheduledAt: z.date().optional(),
});

export function PostNew() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [mediaPrompt, setMediaPrompt] = useState("");
  const [imageStyle, setImageStyle] = useState("photorealistic");
  const [aiProvider, setAiProvider] = useState<ImageProvider>("pollinations");
  const [aiModel, setAiModel] = useState<string>("");
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [mediaTab, setMediaTab] = useState<"upload" | "url" | "ai">("upload");

  const { data: pages, isLoading: loadingPages } = useListPages();
  const createPost = useCreatePost();
  const generateImage = useGenerateImage();
  const uploadFile = useUploadFile();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { pageId: 0, postType: "image", title: "", caption: "", imageUrl: "", videoUrl: "" },
  });

  const postType = form.watch("postType") as PostType;
  const currentProvider = PROVIDERS.find((p) => p.value === aiProvider)!;

  const handleFileUpload = (file: File, isVideo: boolean) => {
    uploadFile.mutate(
      { file },
      {
        onSuccess: (res) => {
          setUploadedFileName(file.name);
          if (isVideo) {
            form.setValue("videoUrl", res.url);
          } else {
            form.setValue("imageUrl", res.url);
          }
          toast({ title: "File uploaded", description: `${file.name} uploaded successfully.` });
        },
        onError: (err) => {
          toast({ title: "Upload failed", description: String(err), variant: "destructive" });
        },
      }
    );
  };

  const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>, isVideo: boolean) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file, isVideo);
  };

  const handleDrop = (e: React.DragEvent, isVideo: boolean) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFileUpload(file, isVideo);
  };

  const handleGenerateImage = () => {
    if (!mediaPrompt) {
      toast({ title: "Prompt required", description: "Please enter an image prompt first.", variant: "destructive" });
      return;
    }
    generateImage.mutate(
      {
        data: {
          prompt: mediaPrompt,
          style: imageStyle,
          provider: aiProvider,
          model: aiModel || undefined,
        },
      },
      {
        onSuccess: (res) => {
          form.setValue("imageUrl", res.imageUrl);
          setUploadedFileName("");
          toast({ title: "Image generated", description: "AI image attached to your post." });
        },
        onError: (error) => {
          toast({ title: "Image generation failed", description: error.message || "Failed to generate image.", variant: "destructive" });
        },
      }
    );
  };

  const clearMedia = () => {
    form.setValue("imageUrl", "");
    form.setValue("videoUrl", "");
    setUploadedFileName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (videoInputRef.current) videoInputRef.current.value = "";
  };

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    const mediaUrl = values.postType === "video" ? values.videoUrl : values.imageUrl;

    // Require media OR a prompt for image/video posts
    // (if a prompt is provided with no image, the scheduler generates the image at publish time)
    if (values.postType !== "text" && !mediaUrl && !mediaPrompt.trim()) {
      toast({
        title: "Media or AI prompt required",
        description: "Upload/link an image or video, or add an AI prompt — the image will be generated when the post publishes.",
        variant: "destructive",
      });
      return;
    }

    createPost.mutate(
      {
        data: {
          pageId: values.pageId,
          title: values.title || null,
          postType: values.postType,
          caption: values.caption,
          imageUrl: mediaUrl || null,
          mediaPrompt: values.postType !== "text" ? (mediaPrompt.trim() || null) : null,
          audioUrl: null,
          scheduledAt: values.scheduledAt ? values.scheduledAt.toISOString() : null,
        },
      },
      {
        onSuccess: (post) => {
          toast({ title: "Post created", description: "Your post has been successfully created." });
          queryClient.invalidateQueries({ queryKey: getListPostsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
          setLocation(`/posts/${post.id}`);
        },
        onError: (error) => {
          toast({ title: "Error creating post", description: error.message || "Something went wrong.", variant: "destructive" });
        },
      }
    );
  };

  if (!loadingPages && (!pages || pages.length === 0)) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-card border border-border rounded-xl text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <h2 className="text-2xl font-bold tracking-tight">No Pages Connected</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          You need to connect at least one Facebook page before you can create posts.
        </p>
        <Button onClick={() => setLocation("/pages")} className="mt-6">Go to Pages</Button>
      </div>
    );
  }

  const currentImageUrl = form.watch("imageUrl");
  const currentVideoUrl = form.watch("videoUrl");

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Create Post</h1>
        <p className="text-muted-foreground mt-1">Compose a new post, upload media or generate AI assets, and schedule for later.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="col-span-1 lg:col-span-2 space-y-6">

              {/* Post Details */}
              <Card className="border-border shadow-sm">
                <CardHeader>
                  <CardTitle className="text-lg">Post Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <FormField
                    control={form.control}
                    name="pageId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Facebook Page</FormLabel>
                        <Select
                          disabled={loadingPages}
                          onValueChange={(val) => field.onChange(parseInt(val, 10))}
                          value={field.value ? field.value.toString() : ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a page to post to" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {pages?.map((page) => (
                              <SelectItem key={page.id} value={page.id.toString()}>{page.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="postType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Post Type</FormLabel>
                        <FormControl>
                          <div className="grid grid-cols-3 gap-2">
                            {([
                              { value: "text", label: "Text", icon: Type },
                              { value: "image", label: "Image", icon: ImageIcon },
                              { value: "video", label: "Video", icon: Video },
                            ] as { value: PostType; label: string; icon: React.ElementType }[]).map(({ value, label, icon: Icon }) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => { field.onChange(value); clearMedia(); }}
                                className={cn(
                                  "flex flex-col items-center justify-center gap-1.5 rounded-lg border-2 p-3 text-sm font-medium transition-all",
                                  field.value === value
                                    ? "border-primary bg-primary/5 text-primary"
                                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                                )}
                              >
                                <Icon className="h-5 w-5" />
                                {label}
                              </button>
                            ))}
                          </div>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <FormControl>
                          <Input placeholder="Give your post a title for your own reference..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="caption"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{postType === "text" ? "Message" : "Caption"}</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={postType === "text" ? "What do you want to share with your audience?" : "Write a caption for your media..."}
                            className="min-h-[140px] resize-y"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>

              {/* Media Section */}
              {postType === "image" && (
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <ImageIcon className="h-5 w-5 text-primary" />
                      Image
                    </CardTitle>
                    <CardDescription>Upload a file, paste a URL, or generate with AI.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={mediaTab} onValueChange={(v) => { setMediaTab(v as typeof mediaTab); clearMedia(); }}>
                      <TabsList className="mb-4 w-full grid grid-cols-3">
                        <TabsTrigger value="upload"><Upload className="h-3.5 w-3.5 mr-1.5" />Upload</TabsTrigger>
                        <TabsTrigger value="url"><ImageIcon className="h-3.5 w-3.5 mr-1.5" />URL</TabsTrigger>
                        <TabsTrigger value="ai"><Sparkles className="h-3.5 w-3.5 mr-1.5" />AI Generate</TabsTrigger>
                      </TabsList>

                      {/* Upload Tab */}
                      <TabsContent value="upload" className="space-y-3">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                          className="hidden"
                          onChange={(e) => handleFilePick(e, false)}
                        />
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          onDrop={(e) => handleDrop(e, false)}
                          onDragOver={(e) => e.preventDefault()}
                          className={cn(
                            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                            uploadFile.isPending
                              ? "border-primary bg-primary/5 cursor-wait"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          )}
                        >
                          {uploadFile.isPending ? (
                            <div className="flex flex-col items-center gap-2 text-primary">
                              <Loader2 className="h-8 w-8 animate-spin" />
                              <p className="text-sm font-medium">Uploading...</p>
                            </div>
                          ) : currentImageUrl && uploadedFileName ? (
                            <div className="flex flex-col items-center gap-2 text-green-600">
                              <ImageIcon className="h-8 w-8" />
                              <p className="text-sm font-medium">{uploadedFileName}</p>
                              <p className="text-xs text-muted-foreground">Click to replace</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <Upload className="h-8 w-8" />
                              <p className="text-sm font-medium">Click or drag & drop your image</p>
                              <p className="text-xs">JPG, PNG, GIF, WebP — up to 100 MB</p>
                            </div>
                          )}
                        </div>
                        {currentImageUrl && uploadedFileName && (
                          <button type="button" onClick={clearMedia} className="text-xs text-destructive flex items-center gap-1 hover:underline">
                            <X className="h-3 w-3" /> Remove file
                          </button>
                        )}
                      </TabsContent>

                      {/* URL Tab */}
                      <TabsContent value="url">
                        <FormField
                          control={form.control}
                          name="imageUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Image URL</FormLabel>
                              <FormControl>
                                <Input placeholder="https://example.com/image.jpg" {...field} />
                              </FormControl>
                              <FormDescription>Paste a publicly accessible image URL. Facebook will fetch it directly.</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>

                      {/* AI Generate Tab */}
                      <TabsContent value="ai" className="space-y-4">
                        {/* Provider selector */}
                        <div className="space-y-2">
                          <Label>AI Provider</Label>
                          <div className="grid grid-cols-2 gap-2">
                            {PROVIDERS.map((p) => (
                              <button
                                key={p.value}
                                type="button"
                                onClick={() => { setAiProvider(p.value); setAiModel(""); }}
                                className={cn(
                                  "flex flex-col items-start rounded-lg border-2 px-3 py-2 text-left text-sm transition-all",
                                  aiProvider === p.value
                                    ? "border-primary bg-primary/5"
                                    : "border-border hover:border-primary/40"
                                )}
                              >
                                <span className="font-medium">{p.label}</span>
                                <span className="text-xs text-muted-foreground">{p.description}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Model selector */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Model</Label>
                            <Select
                              value={aiModel || currentProvider.models[0]!.value}
                              onValueChange={setAiModel}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {currentProvider.models.map((m) => (
                                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Style</Label>
                            <Select value={imageStyle} onValueChange={setImageStyle}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="photorealistic">Photorealistic</SelectItem>
                                <SelectItem value="cartoon">Cartoon</SelectItem>
                                <SelectItem value="watercolor">Watercolor</SelectItem>
                                <SelectItem value="3d-render">3D Render</SelectItem>
                                <SelectItem value="minimalist">Minimalist</SelectItem>
                                <SelectItem value="oil painting">Oil Painting</SelectItem>
                                <SelectItem value="digital art">Digital Art</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label>Prompt</Label>
                          <Textarea
                            placeholder="A serene coffee shop in Tokyo at dawn, warm golden light..."
                            value={mediaPrompt}
                            onChange={(e) => setMediaPrompt(e.target.value)}
                            className="min-h-[80px] resize-none"
                          />
                        </div>

                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={handleGenerateImage}
                            disabled={generateImage.isPending || !mediaPrompt}
                            className="gap-2"
                          >
                            {generateImage.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            Generate
                          </Button>
                          <span className="text-xs text-muted-foreground">
                            {aiProvider === "pollinations" ? "Instant, free" : "~10–30 seconds"}
                          </span>
                        </div>
                      </TabsContent>
                    </Tabs>

                    {/* Preview */}
                    {currentImageUrl && (
                      <div className="mt-4 rounded-md overflow-hidden border border-border aspect-video bg-muted flex items-center justify-center relative group">
                        <img
                          src={currentImageUrl}
                          alt="Preview"
                          className="object-contain h-full w-full"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                        <button
                          type="button"
                          onClick={clearMedia}
                          className="absolute top-2 right-2 bg-background/80 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {postType === "video" && (
                <Card className="border-border shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Video className="h-5 w-5 text-primary" />
                      Video
                    </CardTitle>
                    <CardDescription>Upload a video file or paste a public URL.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Tabs value={mediaTab} onValueChange={(v) => { setMediaTab(v as typeof mediaTab); clearMedia(); }}>
                      <TabsList className="mb-4 w-full grid grid-cols-2">
                        <TabsTrigger value="upload"><Upload className="h-3.5 w-3.5 mr-1.5" />Upload</TabsTrigger>
                        <TabsTrigger value="url"><Video className="h-3.5 w-3.5 mr-1.5" />URL</TabsTrigger>
                      </TabsList>

                      <TabsContent value="upload">
                        <input
                          ref={videoInputRef}
                          type="file"
                          accept="video/mp4,video/quicktime,video/avi,video/x-msvideo,video/mkv"
                          className="hidden"
                          onChange={(e) => handleFilePick(e, true)}
                        />
                        <div
                          onClick={() => videoInputRef.current?.click()}
                          onDrop={(e) => handleDrop(e, true)}
                          onDragOver={(e) => e.preventDefault()}
                          className={cn(
                            "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
                            uploadFile.isPending
                              ? "border-primary bg-primary/5 cursor-wait"
                              : "border-border hover:border-primary/50 hover:bg-muted/50"
                          )}
                        >
                          {uploadFile.isPending ? (
                            <div className="flex flex-col items-center gap-2 text-primary">
                              <Loader2 className="h-8 w-8 animate-spin" />
                              <p className="text-sm font-medium">Uploading...</p>
                            </div>
                          ) : currentVideoUrl && uploadedFileName ? (
                            <div className="flex flex-col items-center gap-2 text-green-600">
                              <Video className="h-8 w-8" />
                              <p className="text-sm font-medium">{uploadedFileName}</p>
                              <p className="text-xs text-muted-foreground">Click to replace</p>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                              <Upload className="h-8 w-8" />
                              <p className="text-sm font-medium">Click or drag & drop your video</p>
                              <p className="text-xs">MP4, MOV, AVI — up to 100 MB</p>
                            </div>
                          )}
                        </div>
                        {currentVideoUrl && uploadedFileName && (
                          <button type="button" onClick={clearMedia} className="mt-2 text-xs text-destructive flex items-center gap-1 hover:underline">
                            <X className="h-3 w-3" /> Remove file
                          </button>
                        )}
                      </TabsContent>

                      <TabsContent value="url">
                        <FormField
                          control={form.control}
                          name="videoUrl"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Video URL</FormLabel>
                              <FormControl>
                                <Input placeholder="https://example.com/video.mp4" {...field} />
                              </FormControl>
                              <FormDescription>
                                Paste a publicly accessible direct video URL (MP4 recommended).
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar */}
            <div className="col-span-1 space-y-6">
              <Card className="border-border shadow-sm sticky top-6">
                <CardHeader>
                  <CardTitle className="text-lg">Publishing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <FormField
                    control={form.control}
                    name="scheduledAt"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Schedule Date <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn("w-full pl-3 text-left font-normal bg-background", !field.value && "text-muted-foreground")}
                              >
                                {field.value ? format(field.value, "PPP p") : <span>Pick a date & time</span>}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={(date) => {
                                if (!date) { field.onChange(undefined); return; }
                                const existing = field.value;
                                if (existing) date.setHours(existing.getHours(), existing.getMinutes());
                                field.onChange(date);
                              }}
                              disabled={(date) => date < startOfDay(new Date())}
                              initialFocus
                            />
                            <div className="p-3 border-t border-border space-y-2">
                              <p className="text-xs text-muted-foreground text-center">Set Time (HH:MM)</p>
                              <Input
                                type="time"
                                className="w-full text-sm"
                                onChange={(e) => {
                                  const time = e.target.value;
                                  if (!time) return;
                                  const [hours, minutes] = time.split(":").map(Number);
                                  const base = field.value ?? new Date();
                                  const newDate = new Date(base);
                                  newDate.setHours(hours!, minutes!);
                                  field.onChange(newDate);
                                }}
                                value={field.value ? format(field.value, "HH:mm") : ""}
                              />
                              {field.value && (
                                <Button type="button" variant="ghost" className="w-full text-sm h-8" onClick={() => field.onChange(undefined)}>
                                  Clear Schedule
                                </Button>
                              )}
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormDescription>Leave empty to save as a draft.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="bg-muted p-4 rounded-lg space-y-2 border border-border/50">
                    <h4 className="font-medium text-sm flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-primary" />
                      Summary
                    </h4>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li className="flex items-center justify-between">
                        <span>Page:</span>
                        <span className="font-medium text-foreground">
                          {form.watch("pageId") ? pages?.find((p) => p.id === form.watch("pageId"))?.name : "None selected"}
                        </span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Type:</span>
                        <span className="font-medium text-foreground capitalize">{postType}</span>
                      </li>
                      <li className="flex items-center justify-between">
                        <span>Action:</span>
                        <span className="font-medium text-foreground">
                          {form.watch("scheduledAt") ? "Schedule" : "Save Draft"}
                        </span>
                      </li>
                    </ul>
                  </div>

                  <Button
                    type="submit"
                    className="w-full gap-2"
                    size="lg"
                    disabled={createPost.isPending || uploadFile.isPending}
                  >
                    {createPost.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : form.watch("scheduledAt") ? (
                      <Clock className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {form.watch("scheduledAt") ? "Schedule Post" : "Save as Draft"}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
