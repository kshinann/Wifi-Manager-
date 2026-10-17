import 'dart:convert';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';

import '../art/art_style.dart';
import 'scene_videos.dart';

/// A downloaded scene video plus the attribution Pexels asks for.
class CachedVideo {
  const CachedVideo({required this.file, this.credit, this.pexelsId});

  final File file;

  /// e.g. "Video by Jane Doe on Pexels".
  final String? credit;
  final int? pexelsId;
}

class VideoUnavailable implements Exception {
  const VideoUnavailable(this.reason);

  final String reason;

  @override
  String toString() => reason;
}

/// Downloads each scene's video once and keeps it in app storage so it plays
/// offline afterwards.
class VideoCache {
  VideoCache({http.Client? client}) : _client = client ?? http.Client();

  final http.Client _client;
  final Map<ArtStyle, Future<CachedVideo>> _inFlight = {};

  static Future<Directory> _dir() async {
    final base = await getApplicationSupportDirectory();
    final dir = Directory('${base.path}/scene_videos');
    if (!dir.existsSync()) dir.createSync(recursive: true);
    return dir;
  }

  /// The cached video, or null if it hasn't been downloaded yet.
  Future<CachedVideo?> cached(ArtStyle style) async {
    final dir = await _dir();
    final file = File('${dir.path}/${style.name}.mp4');
    if (!file.existsSync()) return null;
    String? credit;
    int? id;
    final meta = File('${dir.path}/${style.name}.json');
    if (meta.existsSync()) {
      try {
        final m = jsonDecode(meta.readAsStringSync()) as Map<String, dynamic>;
        credit = m['credit'] as String?;
        id = m['pexelsId'] as int?;
      } catch (_) {}
    }
    return CachedVideo(file: file, credit: credit, pexelsId: id);
  }

  /// Downloads the scene's video, reporting progress from 0 to 1. Concurrent
  /// calls for the same scene share one download.
  Future<CachedVideo> download(ArtStyle style, {void Function(double)? onProgress}) =>
      _inFlight[style] ??= _download(style, onProgress).whenComplete(() => _inFlight.remove(style));

  Future<CachedVideo> _download(ArtStyle style, void Function(double)? onProgress) async {
    final config = sceneVideos[style];
    if (config == null) throw const VideoUnavailable('No video for this theme');

    final source = await _resolve(config);
    final dir = await _dir();
    final part = File('${dir.path}/${style.name}.mp4.part');
    final target = File('${dir.path}/${style.name}.mp4');

    final response = await _client.send(http.Request('GET', Uri.parse(source.link)));
    if (response.statusCode != 200) {
      throw VideoUnavailable('Download failed (${response.statusCode})');
    }
    final total = response.contentLength ?? 0;
    var received = 0;
    final sink = part.openWrite();
    try {
      await for (final chunk in response.stream) {
        sink.add(chunk);
        received += chunk.length;
        if (total > 0) onProgress?.call(received / total);
      }
    } finally {
      await sink.close();
    }
    // Rename only once complete, so a half-downloaded file is never played.
    await part.rename(target.path);

    await File('${dir.path}/${style.name}.json').writeAsString(jsonEncode({
      'credit': source.credit,
      'pexelsId': source.pexelsId,
    }));
    return CachedVideo(file: target, credit: source.credit, pexelsId: source.pexelsId);
  }

  Future<({String link, String? credit, int? pexelsId})> _resolve(SceneVideo config) async {
    final url = config.url;
    if (url != null) return (link: url, credit: null, pexelsId: null);
    if (pexelsApiKey.isEmpty) {
      throw const VideoUnavailable('Add a Pexels API key to download videos');
    }

    final Map<String, dynamic> video;
    if (config.pexelsId != null) {
      video = await _pexels('https://api.pexels.com/videos/videos/${config.pexelsId}');
    } else {
      final uri = Uri.https('api.pexels.com', '/videos/search', {
        'query': config.query,
        'orientation': 'portrait',
        'size': 'medium',
        'per_page': '5',
      });
      final result = await _pexels(uri.toString());
      final videos = (result['videos'] as List?) ?? const [];
      if (videos.isEmpty) throw const VideoUnavailable('No video found');
      video = videos.first as Map<String, dynamic>;
    }

    final link = pickBestFile((video['video_files'] as List?) ?? const []);
    if (link == null) throw const VideoUnavailable('No playable file');
    final user = (video['user'] as Map?)?['name'] as String?;
    return (
      link: link,
      credit: user == null ? 'Video from Pexels' : 'Video by $user on Pexels',
      pexelsId: video['id'] as int?,
    );
  }

  Future<Map<String, dynamic>> _pexels(String url) async {
    final res = await _client.get(Uri.parse(url), headers: {'Authorization': pexelsApiKey});
    if (res.statusCode != 200) {
      throw VideoUnavailable('Pexels error (${res.statusCode})');
    }
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  /// Deletes every downloaded video (e.g. to re-pick after changing queries).
  static Future<void> clear() async {
    final dir = await _dir();
    if (dir.existsSync()) await dir.delete(recursive: true);
  }
}

/// Picks the MP4 closest to 720×1280: sharp on phones without the size of 4K.
String? pickBestFile(List<dynamic> files) {
  String? best;
  var bestScore = double.infinity;
  for (final f in files.whereType<Map>()) {
    final link = f['link'] as String?;
    final type = f['file_type'] as String?;
    final w = (f['width'] as num?)?.toDouble() ?? 0;
    final h = (f['height'] as num?)?.toDouble() ?? 0;
    if (link == null || type != 'video/mp4' || w <= 0 || h <= 0) continue;
    final longSide = w > h ? w : h;
    var score = (longSide - 1280).abs();
    if (longSide > 1920) score += 10000; // avoid 2K/4K downloads
    if (w > h) score += 2000; // portrait files fill a phone screen without cropping
    if (score < bestScore) {
      bestScore = score;
      best = link;
    }
  }
  return best;
}
