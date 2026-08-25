package com.myinsta.app;

import android.annotation.SuppressLint;
import android.app.DownloadManager;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.URLUtil;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import androidx.appcompat.app.AppCompatActivity;
import java.io.InputStream;

public class MainActivity extends AppCompatActivity {

    private WebView webView;

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.myWebView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setUserAgentString("Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36");

        // iPhone-Style Taptic Feedback Bridge
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void tap() {
                runOnUiThread(() -> {
                    try {
                        Vibrator vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
                        if (vibrator != null && vibrator.hasVibrator()) {
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                                vibrator.vibrate(VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK));
                            } else {
                                vibrator.vibrate(12);
                            }
                        }
                    } catch (Exception ignored) {}
                });
            }
        }, "NativeHaptic");

        // Media Downloader
        webView.setDownloadListener(new DownloadListener() {
            @Override
            public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
                try {
                    DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                    request.setMimeType(mimeType);
                    String cookies = CookieManager.getInstance().getCookie(url);
                    request.addRequestHeader("cookie", cookies);
                    request.addRequestHeader("User-Agent", userAgent);
                    request.setDescription("Downloading Media...");
                    request.setTitle(URLUtil.guessFileName(url, contentDisposition, mimeType));
                    request.allowScanningByMediaScanner();
                    request.setNotificationNavigation(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                    request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, URLUtil.guessFileName(url, contentDisposition, mimeType));

                    DownloadManager dm = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                    dm.enqueue(request);
                    Toast.makeText(getApplicationContext(), "Downloading File...", Toast.LENGTH_SHORT).show();
                } catch (Exception e) {
                    Toast.makeText(getApplicationContext(), "Download Error!", Toast.LENGTH_SHORT).show();
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                injectMasterEngine();
            }
        });

        webView.loadUrl("https://www.instagram.com/");
    }

    private void injectMasterEngine() {
        try {
            InputStream input = getAssets().open("insta_engine.js");
            byte[] buffer = new byte[input.available()];
            input.read(buffer);
            input.close();
            String jsCode = new String(buffer);
            webView.evaluateJavascript(jsCode, null);
        } catch (Exception ignored) {}
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
