package com.example.secondapk;

import android.annotation.SuppressLint;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStreamReader;

public class MainActivity extends AppCompatActivity {
    private WebView webView;

    @SuppressLint("JavascriptInterface")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        EdgeToEdge.enable(this);
        setContentView(R.layout.activity_main);
        
        webView = findViewById(R.id.webview);  
        // 启用JavaScript
        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);       
        // 设置WebView客户端，避免使用外部浏览器
        webView.setWebViewClient(new WebViewClient());
        
        // 添加JavaScript接口
        AndroidInterface androidInterface = new AndroidInterface();
        webView.addJavascriptInterface(androidInterface, "AndroidInterface");

        // 添加对话框桥接接口
        webView.addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void showConfirm(String message, final String callbackFunc) {
                runOnUiThread(() -> {
                    new AlertDialog.Builder(MainActivity.this)
                            .setMessage(message)
                            .setPositiveButton("确定", (d, w) -> {
                                webView.evaluateJavascript(callbackFunc + "(true)", null);
                            })
                            .setNegativeButton("取消", (d, w) -> {
                                webView.evaluateJavascript(callbackFunc + "(false)", null);
                            })
                            .setCancelable(false)
                            .create()
                            .show();
                });
            }

            @JavascriptInterface
            public void showAlert(String message, final String callbackFunc) {
                runOnUiThread(() -> {
                    new AlertDialog.Builder(MainActivity.this)
                            .setMessage(message)
                            .setPositiveButton("确定", (d, w) -> {
                                webView.evaluateJavascript(callbackFunc + "()", null);
                            })
                            .setCancelable(false)
                            .create()
                            .show();
                });
            }
        }, "AndroidBridge");


        // 添加JS接口（API 17+需加@JavascriptInterface）
        webView.addJavascriptInterface(new WebAppInterface(), "android");
        // 加载本地HTML文件
        webView.loadUrl("file:///android_asset/web/index.html");
    }

    // JavaScript接口类
    public class AndroidInterface {
        // 数据文件常量
        private static final String RECORDS_FILE = "class_records.json";
        private static final String SETTINGS_FILE = "class_settings.json";
        
        // 默认设置数据
        private static final String DEFAULT_SETTINGS = "{" +
                "\"classes\":[\"23对口计算机\",\"23春电子商务\",\"24春电子商务\",\"23秋电子商务一\"]," +
                "\"courses\":[\"网页设计\",\"网站建设与维护\",\"计算机网络技术\",\"计算机应用基础\"]," +
                "\"types\":[\"理论课\",\"实训课\",\"复习课\"]" +
                "}";

        // 加载记录数据
        @JavascriptInterface
        public String loadData() {
            return readFile(RECORDS_FILE, "[]");
        }

        // 保存记录数据
        @JavascriptInterface
        public void saveData(String data) {
            writeFile(RECORDS_FILE, data);
        }

        // 加载设置数据
        @JavascriptInterface
        public String loadSettings() {
            String rawData = readFile(SETTINGS_FILE, DEFAULT_SETTINGS);
            // 双重验证JSON格式
            try {
                new JSONObject(rawData); // 尝试解析验证
                return rawData;
            } catch (Exception e) {
                return DEFAULT_SETTINGS; // 失败时返回默认值
            }
        }

        // 保存设置数据
        @JavascriptInterface
        public void saveSettings(String settings) {
            writeFile(SETTINGS_FILE, settings);
        }

        // 读取文件内容
        private String readFile(String fileName, String defaultValue) {
            try {
                File file = new File(getFilesDir(), fileName);
                if (!file.exists()) {
                    // 如果文件不存在，创建初始文件
                    writeFile(fileName, defaultValue);
                    return defaultValue;
                }

                FileInputStream fis = openFileInput(fileName);
                InputStreamReader isr = new InputStreamReader(fis);
                BufferedReader bufferedReader = new BufferedReader(isr);
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = bufferedReader.readLine()) != null) {
                    sb.append(line);
                }
                fis.close();
                return sb.toString();
            } catch (Exception e) {
                e.printStackTrace();
                return defaultValue;
            }
        }

        // 写入文件内容
        private void writeFile(String fileName, String data) {
            try {
                FileOutputStream fos = openFileOutput(fileName, MODE_PRIVATE);
                fos.write(data.getBytes());
                fos.close();
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    // JS接口类
    public class WebAppInterface {
        @JavascriptInterface
        public void closeApp() {
            runOnUiThread(() -> {
                finishAffinity(); // 关闭所有关联Activity
                System.exit(0);  // 彻底退出（按需使用）
            });
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.removeJavascriptInterface("android");
            webView.destroy(); // 避免内存泄漏
            webView = null;
        }
        super.onDestroy();
    }

    // 处理返回按钮，使WebView可以返回上一页而不是直接退出应用
    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}