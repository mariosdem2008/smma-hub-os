#!/usr/bin/env pwsh
$maxBytes = 10MB
$offenders = @()

$files = git diff --cached --name-only --diff-filter=AM -z
if ($files) {
  $paths = $files -split "`0" | Where-Object { $_ -ne "" }
  foreach ($path in $paths) {
    if (Test-Path $path) {
      $size = (Get-Item $path).Length
      if ($size -gt $maxBytes) {
        $offenders += [pscustomobject]@{ Size=$size; Path=$path }
      }
    }
  }
}

if ($offenders.Count -gt 0) {
  Write-Error "Error: staged file(s) exceed 10 MB limit (10485760 bytes):"
  foreach ($o in $offenders) {
    Write-Error ("  - {0} bytes  {1}" -f $o.Size, $o.Path)
  }
  Write-Error "Use Git LFS or external storage for large binaries."
  exit 1
}
