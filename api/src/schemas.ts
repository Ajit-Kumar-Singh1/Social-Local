import * as zod from "zod";

export const HealthCheckResponse = zod.object({
  status: zod.string(),
});

export const ListPagesResponse = zod.array(
  zod.object({
    id: zod.number(),
    pageId: zod.string(),
    name: zod.string(),
    category: zod.string().nullish(),
    avatarUrl: zod.string().nullish(),
    accessToken: zod.string(),
    createdAt: zod.coerce.date(),
  })
);

export const ConnectPageBody = zod.object({
  accessToken: zod.string().describe("Facebook user access token — we will fetch page details automatically"),
});

export const DisconnectPageParams = zod.object({
  id: zod.coerce.number(),
});

export const ListPostsQueryParams = zod.object({
  status: zod.enum(["draft", "scheduled", "published", "failed"]).optional(),
  pageId: zod.coerce.number().optional(),
});

export const CreatePostBody = zod.object({
  pageId: zod.number(),
  title: zod.string().nullish(),
  postType: zod.enum(["text", "image", "video"]).optional(),
  caption: zod.string(),
  imageUrl: zod.string().nullish(),
  audioUrl: zod.string().nullish(),
  scheduledAt: zod.string().nullish(),
});

export const GetPostParams = zod.object({
  id: zod.coerce.number(),
});

export const UpdatePostParams = zod.object({
  id: zod.coerce.number(),
});

export const UpdatePostBody = zod.object({
  title: zod.string().nullish(),
  postType: zod.enum(["text", "image", "video"]).optional(),
  caption: zod.string().optional(),
  imageUrl: zod.string().nullish(),
  audioUrl: zod.string().nullish(),
  scheduledAt: zod.string().nullish(),
  status: zod.enum(["draft", "scheduled"]).optional(),
});

export const DeletePostParams = zod.object({
  id: zod.coerce.number(),
});

export const PublishPostParams = zod.object({
  id: zod.coerce.number(),
});

export const GenerateImageBody = zod.object({
  prompt: zod.string().describe("Text prompt to generate an image from"),
  style: zod.string().nullish().describe("Style hint e.g. photorealistic, cartoon, watercolor"),
});
