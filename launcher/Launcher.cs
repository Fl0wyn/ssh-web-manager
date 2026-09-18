using System;
using System.Diagnostics;
using System.IO;
using System.Threading;

namespace SshWebManagerLauncher
{
    internal static class Launcher
    {
        private const string AppUrl = "http://localhost:9100";

        private static int Main()
        {
            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            string projectDir = FindProjectRoot(exeDir);

            if (projectDir == null)
            {
                MessageBoxShim.Show(
                    "Impossible de trouver le projet ssh-web-manager (package.json introuvable).\n" +
                    "Placez ce .exe a la racine du projet ou dans un sous-dossier (ex: launcher/).");
                return 1;
            }

            string pnpmCmd = FindPnpm();
            if (pnpmCmd == null)
            {
                MessageBoxShim.Show(
                    "Impossible de trouver pnpm.CMD.\n" +
                    "Verifiez que pnpm est installe (%LOCALAPPDATA%\\pnpm) ou present dans le PATH.");
                return 1;
            }

            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = "cmd.exe",
                    Arguments = "/c \"\"" + pnpmCmd + "\" start\"",
                    WorkingDirectory = projectDir,
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    WindowStyle = ProcessWindowStyle.Hidden,
                };

                Process serverProcess = Process.Start(psi);

                Thread.Sleep(4000);
                OpenAsApp();

                serverProcess.WaitForExit();
                return serverProcess.ExitCode;
            }
            catch (Exception ex)
            {
                MessageBoxShim.Show("Echec du lancement de SSH Web Manager :\n" + ex.GetType().Name + " : " + ex.Message);
                return 1;
            }
        }

        private static void OpenAsApp()
        {
            string edgePath = FindBrowser(@"Microsoft\Edge\Application\msedge.exe");
            string browserPath = edgePath ?? FindBrowser(@"Google\Chrome\Application\chrome.exe");

            if (browserPath != null)
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = browserPath,
                    Arguments = "--app=" + AppUrl,
                    UseShellExecute = false,
                });
                return;
            }

            // Repli : navigateur par defaut dans un onglet normal.
            Process.Start(new ProcessStartInfo
            {
                FileName = AppUrl,
                UseShellExecute = true,
            });
        }

        private static string FindBrowser(string relativePath)
        {
            string[] roots =
            {
                Environment.GetEnvironmentVariable("ProgramFiles"),
                Environment.GetEnvironmentVariable("ProgramFiles(x86)"),
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            };

            foreach (string root in roots)
            {
                if (string.IsNullOrEmpty(root))
                {
                    continue;
                }

                string candidate = Path.Combine(root, relativePath);
                if (File.Exists(candidate))
                {
                    return candidate;
                }
            }

            return null;
        }

        private static string FindProjectRoot(string startDir)
        {
            var dir = new DirectoryInfo(startDir);
            while (dir != null)
            {
                if (File.Exists(Path.Combine(dir.FullName, "package.json")))
                {
                    return dir.FullName;
                }
                dir = dir.Parent;
            }
            return null;
        }

        private static string FindPnpm()
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string candidate = Path.Combine(localAppData, "pnpm", "pnpm.CMD");
            if (File.Exists(candidate))
            {
                return candidate;
            }

            string pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
            foreach (string dir in pathEnv.Split(Path.PathSeparator))
            {
                if (string.IsNullOrWhiteSpace(dir))
                {
                    continue;
                }

                try
                {
                    string cmdPath = Path.Combine(dir, "pnpm.CMD");
                    if (File.Exists(cmdPath))
                    {
                        return cmdPath;
                    }

                    string exePath = Path.Combine(dir, "pnpm.exe");
                    if (File.Exists(exePath))
                    {
                        return exePath;
                    }
                }
                catch (ArgumentException)
                {
                    // dossier PATH invalide, on continue
                }
            }

            return null;
        }
    }

    internal static class MessageBoxShim
    {
        [System.Runtime.InteropServices.DllImport("user32.dll", CharSet = System.Runtime.InteropServices.CharSet.Auto)]
        private static extern int MessageBox(IntPtr hWnd, string text, string caption, uint type);

        public static void Show(string text)
        {
            MessageBox(IntPtr.Zero, text, "SSH Web Manager", 0x10);
        }
    }
}
