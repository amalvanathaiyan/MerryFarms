import { OWNER_ONLY, requireStaff } from "@/lib/auth"
import { featuresOf } from "@/lib/features"
import { requireFeature } from "@/lib/require-feature"
import { settingsTabs } from "@/lib/farm-sections"
import { SectionHeader } from "@/components/farm/section-header"
import { VideoManager } from "@/components/farm/video-manager"
import { videoSpaceBytes } from "@/domain/videos"
import { listVideos, usedVideoBytes } from "@/server/videos"
import { mediaAvailable } from "@/server/media-store"

/** Settings · Videos (owner): the farm's videos for the shop's banner and "Watch our farm". */
export default async function SettingsVideosPage() {
  const { tenant } = await requireStaff(OWNER_ONLY)
  requireFeature(tenant, "farmVideos")
  const features = featuresOf(tenant)
  const [videos, used] = await Promise.all([listVideos(tenant.id), usedVideoBytes(tenant.id)])
  // Phone uploads: on; not in this farm's plan (YouTube still works); or no storage set up on this server.
  const uploads = !features.videoUploads ? "plan" : mediaAvailable() ? "on" : "off"
  return (
    <div className="flex flex-col gap-4">
      <SectionHeader section="settings" tabs={settingsTabs(features)} active="videos" back={{ href: "/farm/more" }} />
      <VideoManager
        uploads={uploads}
        space={{ used, total: videoSpaceBytes(tenant.videoSpaceMb) }}
        videos={videos.map((v) => ({ id: v.id, kind: v.kind === "youtube" ? "youtube" : "upload", src: v.src, posterUrl: v.posterUrl, title: v.title, banner: v.banner, watch: v.watch, seconds: v.seconds }))}
      />
    </div>
  )
}
