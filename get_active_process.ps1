param (
    [string]$AllowedAppsString = ""
)

$code = @"
    using System;
    using System.Runtime.InteropServices;

    public class Win32 {
        [DllImport("user32.dll")]
        public static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", SetLastError = true)]
        public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

        [DllImport("user32.dll")]
        public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        public const int SW_MINIMIZE = 6;
        public const int SW_FORCEMINIMIZE = 11;
    }
"@

Add-Type -TypeDefinition $code -Language CSharp

try {
    $hwnd = [Win32]::GetForegroundWindow()
    $pidOut = 0
    [Win32]::GetWindowThreadProcessId($hwnd, [ref] $pidOut) | Out-Null
    
    if ($pidOut -ne 0) {
        $proc = Get-Process -Id $pidOut -ErrorAction SilentlyContinue
        if ($proc) {
            $currentApp = $proc.ProcessName
            Write-Output $currentApp

            # Parsing Whitelist
            $allowed = $AllowedAppsString.Split(',')
            
            # Check if allowed (Case insensitive)
            $isAllowed = $false
            foreach ($app in $allowed) {
                if ($currentApp.Equals($app, [StringComparison]::OrdinalIgnoreCase)) {
                    $isAllowed = $true
                    break
                }
            }

            # Self-Protection: Always allow Electron/Video Player processes
            if ($currentApp -match "electron" -or $currentApp -match "video-player") {
                $isAllowed = $true
            }

            if (-not $isAllowed) {
                # THE HAMMER: Minimize it immediately
                # 6 = SW_MINIMIZE (Minimizes the specified window and activates the next top-level window in the Z order)
                # 11 = SW_FORCEMINIMIZE (Minimizes a window, even if the thread that owns the window is not responding)
                [Win32]::ShowWindow($hwnd, 11) 
            }
        }
    }
} catch {
    # Ignore errors
}
