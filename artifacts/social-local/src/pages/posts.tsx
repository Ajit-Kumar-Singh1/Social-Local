import { useState } from "react";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import { 
  useListPosts,
  ListPostsStatus
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Image as ImageIcon,
  Clock,
  CheckCircle2,
  XCircle
} from "lucide-react";

export function Posts() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { data: posts, isLoading } = useListPosts(
    statusFilter !== "all" ? { status: statusFilter as ListPostsStatus } : undefined
  );

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "published": return <CheckCircle2 className="h-4 w-4" />;
      case "scheduled": return <Clock className="h-4 w-4" />;
      case "failed": return <XCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published": return "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20";
      case "scheduled": return "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20";
      case "failed": return "bg-destructive/10 text-destructive border-destructive/20";
      default: return "bg-secondary text-secondary-foreground border-border/50";
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Posts</h1>
          <p className="text-muted-foreground mt-1">Manage your drafts, scheduled, and published posts.</p>
        </div>
        <Button asChild className="gap-2">
          <Link href="/posts/new">
            <Plus className="h-4 w-4" />
            Create Post
          </Link>
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search posts..." 
            className="pl-9 bg-background"
          />
        </div>
        <div className="w-full sm:w-48 flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="bg-background">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Posts</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-4">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-border">
              <CardContent className="p-4 flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/4" />
                </div>
                <Skeleton className="h-8 w-24 rounded-full" />
              </CardContent>
            </Card>
          ))
        ) : posts?.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-card border border-dashed border-border rounded-xl text-center">
            <div className="h-20 w-20 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-6">
              <FileText className="h-10 w-10" />
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">No posts found</h2>
            <p className="text-muted-foreground mt-2 max-w-md">
              {statusFilter !== "all" 
                ? `You don't have any ${statusFilter} posts yet.` 
                : "You haven't created any posts yet. Click the button below to get started."}
            </p>
            {statusFilter === "all" && (
              <Button asChild className="mt-8 gap-2">
                <Link href="/posts/new">
                  <Plus className="h-4 w-4" />
                  Create Your First Post
                </Link>
              </Button>
            )}
          </div>
        ) : (
          posts?.map((post) => (
            <Link key={post.id} href={`/posts/${post.id}`}>
              <Card className="border-border/50 bg-card hover:bg-muted/50 transition-colors cursor-pointer group mb-4 shadow-sm">
                <CardContent className="p-4 flex items-center gap-4">
                  {post.imageUrl ? (
                    <div className="h-16 w-16 rounded-md overflow-hidden bg-muted flex-shrink-0 border border-border">
                      <img src={post.imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-md bg-muted flex-shrink-0 flex items-center justify-center border border-border">
                      <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <p className="text-base font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {post.caption || "Untitled draft"}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-sm text-muted-foreground">
                      <span className="font-medium text-foreground/80">{post.pageName || "Unknown Page"}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        {post.status === "scheduled" && <Clock className="h-3 w-3" />}
                        {post.status === "scheduled" 
                          ? `Scheduled for ${format(new Date(post.scheduledAt!), "MMM d, yyyy 'at' h:mm a")}` 
                          : post.status === "published"
                            ? `Published on ${format(new Date(post.publishedAt!), "MMM d, yyyy")}`
                            : `Created on ${format(new Date(post.createdAt), "MMM d, yyyy")}`
                        }
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <Badge variant="outline" className={`${getStatusColor(post.status)} gap-1.5 px-2.5 py-1`}>
                      {getStatusIcon(post.status)}
                      <span className="capitalize">{post.status}</span>
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
