import '../art/art_style.dart';

/// Where a scene's video comes from. Resolution order: [url], then the
/// Pexels clip [pexelsId], then the top portrait result for [query].
///
/// After reviewing the clips the app picked, pin each one with [pexelsId]
/// (shown in the credit line) so every user sees the same video. For a large
/// release, host the files yourself and set [url] instead, which also takes
/// the Pexels API out of the picture.
class SceneVideo {
  const SceneVideo({required this.query, this.pexelsId, this.url});

  final String query;
  final int? pexelsId;
  final String? url;
}

const sceneVideos = <ArtStyle, SceneVideo>{
  ArtStyle.ocean: SceneVideo(query: 'ocean waves sunset'),
  ArtStyle.fishTank: SceneVideo(query: 'aquarium fish'),
  ArtStyle.forest: SceneVideo(query: 'forest sunlight trees'),
  ArtStyle.aurora: SceneVideo(query: 'aurora borealis'),
  ArtStyle.lavaLamp: SceneVideo(query: 'lava lamp'),
  ArtStyle.snowGlobe: SceneVideo(query: 'snow falling night'),
  ArtStyle.planet: SceneVideo(query: 'planet earth from space'),
  ArtStyle.neonCity: SceneVideo(query: 'neon city night'),
  ArtStyle.rainyWindow: SceneVideo(query: 'rain on window'),
  ArtStyle.volcano: SceneVideo(query: 'volcano lava eruption'),
};

/// Free key from https://www.pexels.com/api/, passed at build time:
/// `flutter run --dart-define=PEXELS_API_KEY=your_key`.
const pexelsApiKey = String.fromEnvironment('PEXELS_API_KEY');
