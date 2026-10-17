import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../art/art_frame.dart';
import '../art/art_style.dart';
import 'scene_videos.dart';
import 'video_cache.dart';

/// Credit line for the scene currently on screen, e.g. "Video by … on Pexels".
typedef SceneCredit = ({ArtStyle style, String text});

/// The artwork behind the UI. Video themes play their real-footage clip
/// (downloaded once, then offline) with the charging glow on top; while the
/// clip downloads, or if it can't, the drawn version of the scene shows.
class ArtBackground extends StatefulWidget {
  const ArtBackground({
    super.key,
    required this.style,
    required this.frame,
    required this.cache,
    required this.credit,
  });

  final ArtStyle style;
  final ValueNotifier<ArtFrame> frame;
  final VideoCache cache;
  final ValueNotifier<SceneCredit?> credit;

  @override
  State<ArtBackground> createState() => _ArtBackgroundState();
}

class _ArtBackgroundState extends State<ArtBackground> {
  VideoPlayerController? _controller;
  double? _progress;
  String? _error;
  double _speed = 1;
  late final AppLifecycleListener _lifecycle;

  bool get _isVideo => sceneVideos.containsKey(widget.style);
  bool get _ready => _controller?.value.isInitialized ?? false;

  @override
  void initState() {
    super.initState();
    _lifecycle = AppLifecycleListener(
      onHide: () => _controller?.pause(),
      onShow: () => _controller?.play(),
    );
    widget.frame.addListener(_syncSpeed);
    if (_isVideo) _load();
  }

  @override
  void dispose() {
    widget.frame.removeListener(_syncSpeed);
    _lifecycle.dispose();
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      var video = await widget.cache.cached(widget.style);
      if (video == null) {
        if (mounted) setState(() => _progress = 0);
        video = await widget.cache.download(
          widget.style,
          onProgress: (p) {
            if (mounted) setState(() => _progress = p);
          },
        );
      }
      if (!mounted) return;
      await _play(video);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _play(CachedVideo video) async {
    final c = VideoPlayerController.file(
      video.file,
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
    );
    try {
      await c.initialize();
    } catch (_) {
      // Corrupt or unsupported file: delete it so the next visit re-downloads.
      await c.dispose();
      try {
        await File(video.file.path).delete();
      } catch (_) {}
      throw const VideoUnavailable('Video could not be played');
    }
    if (!mounted) {
      await c.dispose();
      return;
    }
    await c.setLooping(true);
    await c.setVolume(0);
    await c.play();
    setState(() {
      _controller = c;
      _progress = null;
    });
    _syncSpeed();
    final credit = video.credit;
    widget.credit.value =
        credit == null ? null : (style: widget.style, text: '$credit · #${video.pexelsId ?? '-'}');
  }

  /// Playback speed follows charging power: 0.6x when idle up to 1.5x at
  /// super-fast charging. Rounded so the player isn't updated every frame.
  void _syncSpeed() {
    final c = _controller;
    if (c == null || !_ready) return;
    final target = ((0.6 + widget.frame.value.intensity * 0.9) * 10).round() / 10;
    if (target == _speed) return;
    _speed = target;
    c.setPlaybackSpeed(target);
  }

  @override
  Widget build(BuildContext context) {
    final c = _controller;
    return Stack(
      fit: StackFit.expand,
      children: [
        if (_ready && c != null) ...[
          FittedBox(
            fit: BoxFit.cover,
            clipBehavior: Clip.hardEdge,
            child: SizedBox(
              width: c.value.size.width,
              height: c.value.size.height,
              child: VideoPlayer(c),
            ),
          ),
          CustomPaint(painter: VideoOverlayPainter(widget.frame)),
        ] else
          CustomPaint(painter: widget.style.painter(widget.frame)),
        if (_isVideo && !_ready && (_progress != null || _error != null))
          Align(
            alignment: const Alignment(0, -0.45),
            child: _StatusChip(
              text: _error != null
                  ? '$_error — showing drawn scene'
                  : 'Downloading ${widget.style.label} video… ${((_progress ?? 0) * 100).round()}%',
              progress: _error == null ? _progress : null,
            ),
          ),
      ],
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.text, this.progress});

  final String text;
  final double? progress;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(
            text,
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white, fontSize: 12),
          ),
          if (progress != null) ...[
            const SizedBox(height: 8),
            SizedBox(width: 160, child: LinearProgressIndicator(value: progress)),
          ],
        ],
      ),
    );
  }
}

/// Drawn on top of real footage: a soft glow rising from the bottom to the
/// battery level, a shimmering edge at that height, energy motes while
/// charging, and vignettes so the text stays readable.
class VideoOverlayPainter extends CustomPainter {
  VideoOverlayPainter(this.frame) : super(repaint: frame);

  final ValueNotifier<ArtFrame> frame;

  @override
  void paint(Canvas canvas, Size size) {
    final f = frame.value;
    final w = size.width, h = size.height;

    // Top and bottom vignettes.
    paintVertical(canvas, Rect.fromLTWH(0, 0, w, h * 0.25), [
      Colors.black.withValues(alpha: 0.55),
      Colors.black.withValues(alpha: 0),
    ]);
    paintVertical(canvas, Rect.fromLTWH(0, h * 0.55, w, h * 0.45), [
      Colors.black.withValues(alpha: 0),
      Colors.black.withValues(alpha: 0.6),
    ]);

    // Glow fill up to the battery level.
    final levelY = h * (1 - f.level.clamp(0.0, 1.0));
    final strength = 0.18 + 0.22 * f.intensity;
    paintVertical(canvas, Rect.fromLTRB(0, levelY, w, h), [
      f.accent.withValues(alpha: strength * 0.35),
      f.accent.withValues(alpha: strength),
    ]);

    // Shimmering edge at the level.
    final edge = Path()..moveTo(0, levelY);
    for (var x = 0.0; x <= w + 6; x += 6) {
      edge.lineTo(
        x,
        levelY +
            math.sin(x / w * 2 * math.pi * 2 + f.phase * 2) * 4 +
            math.sin(x / w * 2 * math.pi * 5 - f.phase * 3) * 2,
      );
    }
    final edgePaint = Paint()
      ..style = PaintingStyle.stroke
      ..blendMode = BlendMode.plus;
    canvas.drawPath(
      edge,
      edgePaint
        ..strokeWidth = 8
        ..color = f.accent.withValues(alpha: 0.35)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
    );
    canvas.drawPath(
      edge,
      edgePaint
        ..strokeWidth = 1.5
        ..color = lighten(f.accent, 0.5).withValues(alpha: 0.8)
        ..maskFilter = null,
    );

    // Energy motes rising through the fill while charging.
    if (!f.charging) return;
    final mote = Paint()..blendMode = BlendMode.plus;
    final n = (10 + f.intensity * 40).round();
    for (var i = 0; i < n; i++) {
      final p = frac(hash(i, 200) + f.phase * (0.1 + hash(i, 201) * 0.15));
      final y = h - p * (h - levelY + 40);
      final x = w * hash(i, 202) + math.sin(p * 8 + i) * 10;
      mote.color = lighten(f.accent, 0.5).withValues(alpha: math.sin(p * math.pi) * 0.8);
      canvas.drawCircle(Offset(x, y), 1.2 + hash(i, 203) * 1.8, mote);
    }
  }

  @override
  bool shouldRepaint(VideoOverlayPainter oldDelegate) => oldDelegate.frame != frame;
}
