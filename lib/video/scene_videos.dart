import '../art/art_style.dart';

/// Where a scene's video comes from. Resolution order: [url], then the
/// Pexels clip [pexelsId], then the top portrait Pexels result for [query]
/// (the last two need a Pexels API key).
class SceneVideo {
  const SceneVideo({required this.query, this.pexelsId, this.url, this.credit});

  final String query;
  final int? pexelsId;
  final String? url;

  /// Shown under the theme strip for [url] videos, e.g. "Video by Jane Doe
  /// on Pexels". Pexels doesn't require it but appreciates it.
  final String? credit;
}

/// The videos are assets of this GitHub Release. Every clip is encoded the
/// same way so any Android phone can play it: 720x1280 portrait, H.264 Main
/// profile, 30 fps, no audio, at most 20 s (tool/encode_scene_video.sh).
/// To change a clip, upload it under the same name to a new release and bump
/// the tag here.
const _release = 'https://github.com/kshinann/Wifi-Manager-/releases/download/scene-videos-v2';

const sceneVideos = <ArtStyle, SceneVideo>{
  ArtStyle.ocean: SceneVideo(query: 'ocean waves sunset', url: '$_release/ocean.mp4'),
  ArtStyle.fishTank: SceneVideo(query: 'aquarium fish', url: '$_release/fish_tank.mp4'),
  ArtStyle.forest: SceneVideo(query: 'forest sunlight trees', url: '$_release/forest.mp4'),
  ArtStyle.aurora: SceneVideo(query: 'aurora borealis', url: '$_release/aurora.mp4'),
  ArtStyle.lavaLamp: SceneVideo(query: 'lava lamp', url: '$_release/lava_lamp.mp4'),
  ArtStyle.snowGlobe: SceneVideo(query: 'snow falling night', url: '$_release/snow_globe.mp4'),
  ArtStyle.planet: SceneVideo(query: 'planet earth from space', url: '$_release/planet.mp4'),
  ArtStyle.neonCity: SceneVideo(query: 'neon city night', url: '$_release/neon_city.mp4'),
  ArtStyle.rainyWindow: SceneVideo(query: 'rain on window', url: '$_release/rainy_window.mp4'),
  ArtStyle.volcano: SceneVideo(query: 'volcano lava eruption', url: '$_release/volcano.mp4'),
};

/// Optional: only needed for scenes without a [SceneVideo.url]. Passed at
/// build time with `--dart-define=PEXELS_API_KEY=your_key`.
const pexelsApiKey = String.fromEnvironment('PEXELS_API_KEY');
