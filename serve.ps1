# Local HTTP server (PowerShell, no Python/Node)
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

$port = 8080
$root = (Get-Location).Path
$prefix = "http://localhost:$port/"

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.htm'  = 'text/html; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.js'   = 'text/javascript; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.gif'  = 'image/gif'
  '.webp' = 'image/webp'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.mp3'  = 'audio/mpeg'
  '.wav'  = 'audio/wav'
  '.woff' = 'font/woff'
  '.woff2'= 'font/woff2'
  '.txt'  = 'text/plain; charset=utf-8'
}

function Get-LocalPath([string]$rawUrl) {
  $uri = [System.Uri]$rawUrl
  $path = [System.Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart('/'))
  if ([string]::IsNullOrWhiteSpace($path)) { $path = 'index.html' }
  $full = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $path.Replace('/', [IO.Path]::DirectorySeparatorChar)))
  if (-not $full.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) { return $null }
  return $full
}

function Send-Bytes($ctx, [byte[]]$bytes, [string]$contentType, [int]$code) {
  $ctx.Response.StatusCode = $code
  $ctx.Response.ContentType = $contentType
  $ctx.Response.ContentLength64 = $bytes.Length
  $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  $ctx.Response.OutputStream.Close()
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()

Write-Host ''
Write-Host ' Chocolate & Cereza - servidor local' -ForegroundColor Magenta
Write-Host " $prefix" -ForegroundColor Cyan
Write-Host " Pasta: $root" -ForegroundColor DarkGray
Write-Host ''
Write-Host ' Feche esta janela para parar.' -ForegroundColor DarkGray
Write-Host ''

Start-Process ($prefix + 'index.html')

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    try {
      $local = Get-LocalPath $ctx.Request.Url.AbsoluteUri
      if (-not $local) {
        Send-Bytes $ctx ([Text.Encoding]::UTF8.GetBytes('403 Forbidden')) 'text/plain' 403
        continue
      }
      if (Test-Path $local -PathType Container) {
        $local = Join-Path $local 'index.html'
      }
      if (-not (Test-Path $local -PathType Leaf)) {
        Send-Bytes $ctx ([Text.Encoding]::UTF8.GetBytes('404 Not Found')) 'text/plain' 404
        continue
      }
      $ext = [System.IO.Path]::GetExtension($local).ToLowerInvariant()
      $type = $mime[$ext]
      if (-not $type) { $type = 'application/octet-stream' }
      $bytes = [System.IO.File]::ReadAllBytes($local)
      Send-Bytes $ctx $bytes $type 200
    } catch {
      try {
        Send-Bytes $ctx ([Text.Encoding]::UTF8.GetBytes('500 Internal Server Error')) 'text/plain' 500
      } catch { }
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
}
