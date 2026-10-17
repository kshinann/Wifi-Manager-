import 'package:charge_verse/video/video_cache.dart';
import 'package:flutter_test/flutter_test.dart';

Map<String, Object> file(String link, int w, int h, [String type = 'video/mp4']) =>
    {'link': link, 'width': w, 'height': h, 'file_type': type};

void main() {
  test('prefers the portrait MP4 closest to 720x1280', () {
    expect(
      pickBestFile([
        file('sd', 360, 640),
        file('hd', 720, 1280),
        file('fhd', 1080, 1920),
      ]),
      'hd',
    );
  });

  test('avoids 4K and landscape when a portrait HD file exists', () {
    expect(
      pickBestFile([
        file('uhd', 2160, 3840),
        file('landscape', 1280, 720),
        file('portrait', 1080, 1920),
      ]),
      'portrait',
    );
  });

  test('ignores non-MP4 and malformed entries', () {
    expect(
      pickBestFile([
        file('hls', 720, 1280, 'application/x-mpegURL'),
        {'link': 'broken'},
        file('ok', 540, 960),
      ]),
      'ok',
    );
    expect(pickBestFile(const []), isNull);
  });
}
