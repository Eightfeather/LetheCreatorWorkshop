using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

namespace TheLetheWorkbench
{
    internal sealed class MainForm : Form
    {
        private WebView2 _web;
        private readonly ServerRunner _runner;
        private readonly ServerInfo _info;

        private Panel _fatalPanel;
        private Timer _bootTimer;
        private int _processFailures;
        private int _renderRecoveries;
        private bool _compatRender;
        private bool _fatalShown;

        private static string FlagsPath
        {
            get { return Path.Combine(Payload.DataDir, "flags.json"); }
        }

        public MainForm(ServerInfo info, ServerRunner runner)
        {
            _info = info;
            _runner = runner;
            _compatRender = ReadFlag("disableGpu");

            Text = "The Lethe Workbench";
            var wa = Screen.PrimaryScreen.WorkingArea;
            Width = Math.Max(1200, (int)(wa.Width * 0.92));
            Height = Math.Max(800, (int)(wa.Height * 0.92));
            MinimumSize = new Size(1100, 720);
            StartPosition = FormStartPosition.CenterScreen;
            BackColor = ColorTranslator.FromHtml("#12100E");
            DoubleBuffered = true;

            CreateWebView();

            Load += OnLoadAsync;
        }

        // ---------- flags.json（与前端设置里的「兼容渲染」共用） ----------

        private static bool ReadFlag(string key)
        {
            try
            {
                if (!File.Exists(FlagsPath)) return false;
                string text = File.ReadAllText(FlagsPath);
                var m = Regex.Match(text, "\"" + Regex.Escape(key) + "\"\\s*:\\s*(true|false)", RegexOptions.IgnoreCase);
                return m.Success && m.Groups[1].Value.Equals("true", StringComparison.OrdinalIgnoreCase);
            }
            catch { return false; }
        }

        private static void WriteFlag(string key, bool value)
        {
            try
            {
                Directory.CreateDirectory(Payload.DataDir);
                string text = "{\r\n  \"" + key + "\": " + (value ? "true" : "false") + ",\r\n" +
                              "  \"updatedAt\": \"" + DateTime.UtcNow.ToString("o") + "\"\r\n}\r\n";
                File.WriteAllText(FlagsPath, text, new System.Text.UTF8Encoding(false));
            }
            catch { }
        }

        // ---------- WebView2 生命周期 ----------

        private void CreateWebView()
        {
            _web = new WebView2
            {
                Dock = DockStyle.Fill,
                DefaultBackgroundColor = ColorTranslator.FromHtml("#12100E"),
                AllowExternalDrop = false,
            };
            Controls.Add(_web);
            _web.BringToFront();
        }

        private async void OnLoadAsync(object sender, EventArgs e)
        {
            await BootAsync(false);
        }

        private async Task BootAsync(bool forceCompat)
        {
            try
            {
                string userData = Path.Combine(Payload.DataDir, "webview2");
                Directory.CreateDirectory(userData);

                var options = new CoreWebView2EnvironmentOptions(
                    (forceCompat || _compatRender) ? "--disable-gpu --disable-software-rasterizer --in-process-gpu" : null);
                CoreWebView2Environment env = await CoreWebView2Environment.CreateAsync(null, userData, options);
                await _web.EnsureCoreWebView2Async(env);

                var core = _web.CoreWebView2;
                core.Settings.AreDevToolsEnabled = false;
                core.Settings.AreDefaultContextMenusEnabled = false;
                core.Settings.IsStatusBarEnabled = false;
                core.Settings.IsZoomControlEnabled = false;
                core.Settings.AreBrowserAcceleratorKeysEnabled = false;
                core.Settings.IsSwipeNavigationEnabled = false;

                core.ProcessFailed += OnProcessFailed;
                core.NavigationCompleted += OnNavigationCompleted;
                core.Navigate(_info.Url);

                StartBootWatchdog();
            }
            catch (Exception ex)
            {
                ShowFatal(
                    "界面引擎（WebView2）初始化失败",
                    ex.Message + "\r\n\r\n日志目录：" + Path.Combine(Payload.DataDir, "logs"),
                    true);
            }
        }

        private void StartBootWatchdog()
        {
            StopBootWatchdog();
            _bootTimer = new Timer { Interval = 12000 };
            _bootTimer.Tick += async (s, e) =>
            {
                _bootTimer.Stop();
                try
                {
                    string r = await _web.CoreWebView2.ExecuteScriptAsync("Boolean(window.__WBS)");
                    if (!string.Equals(r, "true", StringComparison.OrdinalIgnoreCase))
                    {
                        ShowFatal(
                            "界面脚本没有启动",
                            "页面已经加载，但前端脚本 12 秒内没有完成初始化。\r\n" +
                            "常见原因：WebView2 缓存损坏、GPU 进程异常、或脚本报错。\r\n\r\n" +
                            "日志：" + Path.Combine(Payload.DataDir, "logs", "server.log"),
                            true);
                    }
                }
                catch { }
            };
            _bootTimer.Start();
        }

        private void StopBootWatchdog()
        {
            if (_bootTimer != null)
            {
                _bootTimer.Stop();
                _bootTimer.Dispose();
                _bootTimer = null;
            }
        }

        // ---------- 失败处理：自动恢复一次 → 兼容渲染 → 可见错误页 ----------

        private async void OnProcessFailed(object sender, CoreWebView2ProcessFailedEventArgs e)
        {
            _processFailures++;
            string kind = e.ProcessFailedKind.ToString();
            bool gpu = kind.IndexOf("Gpu", StringComparison.OrdinalIgnoreCase) >= 0;

            try
            {
                if (!gpu && _renderRecoveries < 1)
                {
                    _renderRecoveries++;
                    _web.CoreWebView2.Reload();
                    return;
                }

                if (!_compatRender && _renderRecoveries < 3)
                {
                    // 首次 GPU/多次渲染失败：切到兼容渲染并记住，下次启动直接用软件渲染
                    _renderRecoveries++;
                    _compatRender = true;
                    WriteFlag("disableGpu", true);
                    await RebuildWebViewAsync(true);
                    return;
                }

                if (_renderRecoveries < 4)
                {
                    _renderRecoveries++;
                    await RebuildWebViewAsync(_compatRender);
                    return;
                }
            }
            catch { }

            ShowFatal(
                "界面进程反复崩溃（" + kind + "）",
                "已尝试自动恢复与兼容渲染仍未成功。\r\n" +
                "建议：关闭其它占用 GPU 的程序（如游戏）后点「重试」，或在设置中开启「兼容渲染」。\r\n\r\n" +
                "日志：" + Path.Combine(Payload.DataDir, "logs", "server.log"),
                true);
        }

        private void OnNavigationCompleted(object sender, CoreWebView2NavigationCompletedEventArgs e)
        {
            if (!e.IsSuccess)
            {
                ShowFatal(
                    "页面加载失败（" + e.WebErrorStatus + "）",
                    "无法从本地后端加载界面。\r\n" +
                    "后端地址：" + _info.Url + "\r\n" +
                    "日志：" + Path.Combine(Payload.DataDir, "logs", "server.log"),
                    false);
                return;
            }
            StopBootWatchdog();
            StartBootWatchdog();
        }

        private async Task RebuildWebViewAsync(bool compat)
        {
            try
            {
                if (_web != null)
                {
                    _web.CoreWebView2.ProcessFailed -= OnProcessFailed;
                    _web.CoreWebView2.NavigationCompleted -= OnNavigationCompleted;
                    Controls.Remove(_web);
                    _web.Dispose();
                    _web = null;
                }
            }
            catch { }

            HideFatal();
            CreateWebView();
            await BootAsync(compat);
        }

        // ---------- 错误页 ----------

        private void ShowFatal(string title, string detail, bool withCompatButton)
        {
            _fatalShown = true;
            StopBootWatchdog();

            if (_fatalPanel == null)
            {
                _fatalPanel = new Panel
                {
                    Dock = DockStyle.Fill,
                    BackColor = ColorTranslator.FromHtml("#12100E"),
                    Padding = new Padding(40),
                };

                var box = new TableLayoutPanel
                {
                    Dock = DockStyle.Fill,
                    ColumnCount = 1,
                    RowCount = 4,
                    BackColor = ColorTranslator.FromHtml("#12100E"),
                };
                box.RowStyles.Add(new RowStyle(SizeType.AutoSize));
                box.RowStyles.Add(new RowStyle(SizeType.Percent, 100f));
                box.RowStyles.Add(new RowStyle(SizeType.AutoSize));
                box.RowStyles.Add(new RowStyle(SizeType.AutoSize));

                var head = new Label
                {
                    Text = "THE LETHE WORKBENCH",
                    AutoSize = true,
                    Font = new Font("Georgia", 11f, FontStyle.Bold),
                    ForeColor = ColorTranslator.FromHtml("#C6A15B"),
                    Margin = new Padding(0, 0, 0, 10),
                };
                var titleLbl = new Label
                {
                    Text = title,
                    AutoSize = true,
                    Font = new Font("Microsoft YaHei UI", 14f, FontStyle.Bold),
                    ForeColor = ColorTranslator.FromHtml("#E8DCC6"),
                    Margin = new Padding(0, 0, 0, 8),
                };
                var detailBox = new TextBox
                {
                    Text = detail,
                    Multiline = true,
                    ReadOnly = true,
                    ScrollBars = ScrollBars.Vertical,
                    Dock = DockStyle.Fill,
                    BorderStyle = BorderStyle.FixedSingle,
                    BackColor = ColorTranslator.FromHtml("#1C1714"),
                    ForeColor = ColorTranslator.FromHtml("#A79780"),
                    Font = new Font("Consolas", 9.5f),
                };

                var buttons = new FlowLayoutPanel
                {
                    FlowDirection = FlowDirection.LeftToRight,
                    AutoSize = true,
                    Dock = DockStyle.Top,
                    Margin = new Padding(0, 12, 0, 0),
                };
                var retry = new Button { Text = "重试", AutoSize = true, Padding = new Padding(14, 6, 14, 6) };
                retry.Click += async (s, e) => { HideFatal(); await RebuildWebViewAsync(_compatRender); };
                buttons.Controls.Add(retry);

                if (withCompatButton)
                {
                    var compat = new Button { Text = "以兼容渲染重试", AutoSize = true, Padding = new Padding(14, 6, 14, 6) };
                    compat.Click += async (s, e) => { _compatRender = true; WriteFlag("disableGpu", true); HideFatal(); await RebuildWebViewAsync(true); };
                    buttons.Controls.Add(compat);
                }

                var logs = new Button { Text = "打开日志目录", AutoSize = true, Padding = new Padding(14, 6, 14, 6) };
                logs.Click += (s, e) =>
                {
                    try { Process.Start("explorer.exe", Path.Combine(Payload.DataDir, "logs")); } catch { }
                };
                buttons.Controls.Add(logs);

                var copy = new Button { Text = "复制诊断信息", AutoSize = true, Padding = new Padding(14, 6, 14, 6) };
                copy.Click += (s, e) =>
                {
                    try { Clipboard.SetText(detail + "\r\n" + title); } catch { }
                };
                buttons.Controls.Add(copy);

                var headWrap = new FlowLayoutPanel { FlowDirection = FlowDirection.TopDown, AutoSize = true, Dock = DockStyle.Top };
                headWrap.Controls.Add(head);
                headWrap.Controls.Add(titleLbl);

                box.Controls.Add(headWrap, 0, 0);
                box.Controls.Add(detailBox, 0, 1);
                box.Controls.Add(buttons, 0, 2);
                _fatalPanel.Controls.Add(box);
            }
            else
            {
                var box = _fatalPanel.Controls[0] as TableLayoutPanel;
                if (box != null)
                {
                    ((FlowLayoutPanel)box.GetControlFromPosition(0, 0)).Controls[1].Text = title;
                    ((TextBox)box.GetControlFromPosition(0, 1)).Text = detail;
                }
            }

            Controls.Add(_fatalPanel);
            _fatalPanel.BringToFront();
        }

        private void HideFatal()
        {
            if (_fatalPanel != null && Controls.Contains(_fatalPanel))
            {
                Controls.Remove(_fatalPanel);
            }
            _fatalShown = false;
        }

        protected override void OnFormClosed(FormClosedEventArgs e)
        {
            StopBootWatchdog();
            try
            {
                if (_web != null && _web.CoreWebView2 != null)
                {
                    _web.CoreWebView2.ProcessFailed -= OnProcessFailed;
                    _web.CoreWebView2.NavigationCompleted -= OnNavigationCompleted;
                }
            }
            catch { }
            base.OnFormClosed(e);
            try { _runner.Dispose(); } catch { }
        }
    }
}
