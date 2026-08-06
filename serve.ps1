# Servidor local multi-abas (C# embutido — estável no Windows)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$port = 8765
$root = (Get-Location).Path -replace '\\', '\\'

if (-not ([System.Management.Automation.PSTypeName]'LocalSiteServer').Type) {
  Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Text;
using System.Threading;

public static class LocalSiteServer
{
    static readonly Dictionary<string, string> Mime = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
        { ".html", "text/html; charset=utf-8" },
        { ".htm", "text/html; charset=utf-8" },
        { ".css", "text/css; charset=utf-8" },
        { ".js", "text/javascript; charset=utf-8" },
        { ".json", "application/json; charset=utf-8" },
        { ".png", "image/png" },
        { ".jpg", "image/jpeg" },
        { ".jpeg", "image/jpeg" },
        { ".gif", "image/gif" },
        { ".webp", "image/webp" },
        { ".svg", "image/svg+xml" },
        { ".ico", "image/x-icon" },
        { ".mp3", "audio/mpeg" },
        { ".wav", "audio/wav" },
        { ".woff", "font/woff" },
        { ".woff2", "font/woff2" },
        { ".txt", "text/plain; charset=utf-8" }
    };

    public static void Run(string rootPath, int port)
    {
        var root = Path.GetFullPath(rootPath);
        var listener = new HttpListener();
        listener.Prefixes.Add("http://localhost:" + port + "/");
        listener.Start();

        while (listener.IsListening)
        {
            var ctx = listener.GetContext();
            ThreadPool.QueueUserWorkItem(_ => Handle(ctx, root));
        }
    }

    static void Handle(HttpListenerContext ctx, string root)
    {
        try
        {
            var path = ctx.Request.Url.AbsolutePath.TrimStart('/');
            if (string.IsNullOrWhiteSpace(path)) path = "index.html";
            path = Uri.UnescapeDataString(path).Replace('/', Path.DirectorySeparatorChar);
            var local = Path.GetFullPath(Path.Combine(root, path));

            if (!local.StartsWith(root, StringComparison.OrdinalIgnoreCase))
            {
                Write(ctx, 403, "403 Forbidden", "text/plain; charset=utf-8");
                return;
            }

            if (Directory.Exists(local))
                local = Path.Combine(local, "index.html");

            if (!File.Exists(local))
            {
                Write(ctx, 404, "404 Not Found", "text/plain; charset=utf-8");
                return;
            }

            var ext = Path.GetExtension(local);
            string mime;
            if (!Mime.TryGetValue(ext ?? "", out mime))
                mime = "application/octet-stream";

            var bytes = File.ReadAllBytes(local);
            WriteBytes(ctx, 200, bytes, mime);
        }
        catch
        {
            try { Write(ctx, 500, "500 Internal Server Error", "text/plain; charset=utf-8"); } catch { }
        }
    }

    static void Write(HttpListenerContext ctx, int code, string text, string mime)
    {
        WriteBytes(ctx, code, Encoding.UTF8.GetBytes(text), mime);
    }

    static void WriteBytes(HttpListenerContext ctx, int code, byte[] bytes, string mime)
    {
        ctx.Response.StatusCode = code;
        ctx.Response.ContentType = mime;
        ctx.Response.ContentLength64 = bytes.Length;
        ctx.Response.OutputStream.Write(bytes, 0, bytes.Length);
        ctx.Response.OutputStream.Close();
    }
}
"@
}

$url = "http://localhost:$port/"

Write-Host ''
Write-Host ' Chocolate & Cereza - servidor local' -ForegroundColor Magenta
Write-Host " $url" -ForegroundColor Cyan
Write-Host " Pasta: $((Get-Location).Path)" -ForegroundColor DarkGray
Write-Host ''
Write-Host ' Varias abas/janelas OK (Chrome + anonimo).' -ForegroundColor Green
Write-Host ' Feche esta janela para parar.' -ForegroundColor DarkGray
Write-Host ''

Start-Process ($url + 'index.html')

try {
  [LocalSiteServer]::Run((Get-Location).Path, $port)
} catch {
  Write-Host ''
  Write-Host ' ERRO: porta 8765 ocupada ou sem permissao.' -ForegroundColor Red
  Write-Host ' Feche outras janelas do ABRIR-SITE.bat e tente de novo.' -ForegroundColor Yellow
  Write-Host " Detalhe: $($_.Exception.Message)" -ForegroundColor DarkGray
  Write-Host ''
  pause
}
