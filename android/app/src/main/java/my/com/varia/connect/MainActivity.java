package my.com.varia.connect;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.GeolocationPermissions;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

/**
 * Wraps the Varia Connect mockup (mockup/sitelink.html) in a WebView and
 * connects it to the phone's camera, gallery, GPS and back button.
 *
 * The page is served from https://appassets.androidplatform.net so the
 * WebView treats it as a secure origin (needed for geolocation and storage).
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";
    private static final String PAGE_ASSET = "sitelink.html";

    private static final int REQ_FILE = 1;
    private static final int REQ_PERM_CAMERA = 2;
    private static final int REQ_PERM_LOCATION = 3;

    // The mockup is written as a page body; the web host adds this skeleton
    // when it publishes, so the app adds the same one.
    private static final String HEAD =
            "<!doctype html><html lang=\"en\"><head><meta charset=\"utf-8\">"
            + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">"
            + "<style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}"
            + "img{max-width:100%}[hidden]{display:none!important}</style></head><body>";
    private static final String TAIL = "</body></html>";

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private String geoOrigin;
    private GeolocationPermissions.Callback geoCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setGeolocationEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) {
                    String path = u.getPath();
                    if (path == null || path.equals("/") || path.equals("/index.html")) {
                        return pageResponse();
                    }
                    if (path.startsWith("/data/") && path.endsWith(".js") && !path.contains("..")) {
                        try {
                            return new WebResourceResponse("text/javascript", "utf-8",
                                    getAssets().open(path.substring(1)));
                        } catch (IOException ignored) {
                            // fall through to 404
                        }
                    }
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", null,
                            new ByteArrayInputStream(new byte[0]));
                }
                return null; // fonts and other links load from the network as normal
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (ActivityNotFoundException ignored) {
                    // No app can open this link; stay on the page.
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    launchPhotoChooser(true);
                } else {
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, REQ_PERM_CAMERA);
                }
                return true;
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (hasLocationPermission()) {
                    callback.invoke(origin, true, false);
                } else {
                    geoOrigin = origin;
                    geoCallback = callback;
                    requestPermissions(new String[]{
                            Manifest.permission.ACCESS_FINE_LOCATION,
                            Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_PERM_LOCATION);
                }
            }
        });

        web.loadUrl(START_URL);
    }

    private WebResourceResponse pageResponse() {
        try (InputStream in = getAssets().open(PAGE_ASSET)) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            out.write(HEAD.getBytes(StandardCharsets.UTF_8));
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            out.write(TAIL.getBytes(StandardCharsets.UTF_8));
            return new WebResourceResponse("text/html", "utf-8",
                    new ByteArrayInputStream(out.toByteArray()));
        } catch (IOException e) {
            String msg = HEAD + "<p style=\"padding:16px\">The app page could not be loaded. Reinstall the app.</p>" + TAIL;
            return new WebResourceResponse("text/html", "utf-8",
                    new ByteArrayInputStream(msg.getBytes(StandardCharsets.UTF_8)));
        }
    }

    private boolean hasLocationPermission() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
                || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    /** Opens a chooser with the camera first, plus the gallery and file apps. */
    private void launchPhotoChooser(boolean withCamera) {
        Intent pick = new Intent(Intent.ACTION_GET_CONTENT);
        pick.addCategory(Intent.CATEGORY_OPENABLE);
        pick.setType("image/*");
        Intent chooser = Intent.createChooser(pick, getString(R.string.photo_chooser));

        cameraUri = null;
        if (withCamera) {
            try {
                File dir = new File(getCacheDir(), "photos");
                if (!dir.exists() && !dir.mkdirs()) throw new IOException("Cannot create photo folder");
                File photo = File.createTempFile("hazard_", ".jpg", dir);
                cameraUri = FileProvider.getUriForFile(this, getPackageName() + ".files", photo);
                Intent cam = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                cam.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                cam.setClipData(ClipData.newRawUri("", cameraUri));
                cam.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cam});
            } catch (IOException | IllegalArgumentException e) {
                cameraUri = null;
            }
        }

        try {
            startActivityForResult(chooser, REQ_FILE);
        } catch (ActivityNotFoundException e) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (data != null && data.getData() != null) {
                result = new Uri[]{data.getData()};
            } else if (cameraUri != null) {
                result = new Uri[]{cameraUri};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        boolean granted = false;
        for (int r : grantResults) granted |= r == PackageManager.PERMISSION_GRANTED;

        if (requestCode == REQ_PERM_CAMERA) {
            // Without camera permission the chooser still offers the gallery.
            if (fileCallback != null) launchPhotoChooser(granted);
        } else if (requestCode == REQ_PERM_LOCATION && geoCallback != null) {
            geoCallback.invoke(geoOrigin, granted, false);
            geoCallback = null;
            geoOrigin = null;
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // Let the page close a dialog or go back to Overview first.
        web.evaluateJavascript("(window.vcBack && window.vcBack()) ? 'handled' : 'exit'", value -> {
            if (!"\"handled\"".equals(value)) finish();
        });
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }
}
