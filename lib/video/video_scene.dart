import 'dart:io';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
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
    required this.current,
  });

  final ArtStyle style;
  final ValueNotifier<ArtFrame> frame;
  final VideoCache cache;
  final ValueNotifier<SceneCredit?> credit;

  /// The theme currently selected. While this scene fades out after another
  /// is picked, its video is stopped right away: mid-range phones have few
  /// hardware decoders, and two videos at once can make the new one fail.
  final ValueListenable<ArtStyle> current;

  @override
  State<ArtBackground> createState() => _ArtBackgroundState();
}

class _ArtBackgroundState extends State<ArtBackground> {
  VideoPlayerController? _controller;
  File? _file;
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
      onShow: () {
        if (_isCurrent) _controller?.play();
      },
    );
    widget.frame.addListener(_syncSpeed);
    widget.current.addListener(_onSelectionChanged);
    if (_isVideo) _load();
  }

  @override
  void dispose() {
    widget.frame.removeListener(_syncSpeed);
    widget.current.removeListener(_onSelectionChanged);
    _lifecycle.dispose();
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (mounted) setState(() => _error = null);
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
      // Shows in the `flutter run` console, to help diagnose a scene.
      debugPrint('ChargeVerse video [${widget.style.name}]: $e');
      if (mounted) {
        setState(() {
          _error = e.toString();
          _progress = null;
        });
      }
    }
  }

  /// Some files load but then fail to decode (e.g. 4K or 60 fps clips on
  /// mid-range phones). Drop the file so the next try downloads it again, and
  /// fall back to the drawn scene with a retry button.
  void _watchForErrors() {
    final c = _controller;
    if (c == null || !c.value.hasError) return;
    c.removeListener(_watchForErrors);
    debugPrint('ChargeVerse video [${widget.style.name}] playback error: ${c.value.errorDescription}');
    final file = _file;
    setState(() {
      _controller = null;
      _error = 'Video could not be played on this phone';
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => c.dispose());
    try {
      file?.deleteSync();
    } catch (_) {}
  }

  bool get _isCurrent => widget.current.value == widget.style;

  void _onSelectionChanged() {
    if (_isCurrent) return;
    final c = _controller;
    if (c == null) return;
    c.removeListener(_watchForErrors);
    setState(() => _controller = null);
    WidgetsBinding.instance.addPostFrameCallback((_) => c.dispose());
  }

  void _retry() {
    setState(() {
      _error = null;
      _progress = 0;
    });
    _load();
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
      throw const VideoUnavailable('Video could not be played on this phone');
    }
    if (!mounted || !_isCurrent) {
      await c.dispose();
      return;
    }
    await c.setLooping(true);
    await c.setVolume(0);
    await c.play();
    setState(() {
      _controller = c;
      _file = video.file;
      _progress = null;
    });
    c.addListener(_watchForErrors);
    _syncSpeed();
    final credit = video.credit;
    final id = video.pexelsId;
    widget.credit.value = credit == null
        ? null
        : (style: widget.style, text: id == null ? credit : '$credit · #$id');
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
              onRetry: _error != null ? _retry : null,
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
  const _StatusChip({required this.text, this.progress, this.onRetry});

  final String text;
  final double? progress;
  final VoidCallback? onRetry;

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
          if (onRetry != null)
            TextButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              label: const Text('Try again'),
            ),
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
