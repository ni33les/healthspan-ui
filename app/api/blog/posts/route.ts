import {
  createBlogPost,
  listBlogPostsForApi
} from "@/lib/blog";
import {
  openClawJson,
  readJsonObject,
  requireOpenClawRequest
} from "@/lib/openclaw-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = requireOpenClawRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  const posts = await listBlogPostsForApi({
    locale: url.searchParams.get("locale"),
    status
  });

  return openClawJson({ posts });
}

export async function POST(request: Request) {
  const unauthorized = requireOpenClawRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const post = await createBlogPost(await readJsonObject(request));

    return openClawJson(
      { post },
      {
        status: 201
      }
    );
  } catch (error) {
    return openClawJson(
      {
        message:
          error instanceof Error ? error.message : "Unable to create blog post"
      },
      {
        status: 400
      }
    );
  }
}
