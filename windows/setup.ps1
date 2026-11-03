$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2
$root = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $root
$runtime = Join-Path $root '.runtime'
$nodeDir = Join-Path $runtime 'node'
$node = Join-Path $nodeDir 'node.exe'

function Invoke-Checked {
    param([string]$Executable, [string[]]$CommandArguments)
    & $Executable @CommandArguments
    if ($LASTEXITCODE -ne 0) { throw "Komut basarisiz oldu (kod $LASTEXITCODE)." }
}
function Read-PrivatePassword {
    $first = Read-Host 'Yonetim sifrenizi belirleyin (12-128 karakter)' -AsSecureString
    $second = Read-Host 'Ayni sifreyi tekrar girin' -AsSecureString
    $one = [IntPtr]::Zero
    $two = [IntPtr]::Zero
    try {
        $one = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($first)
        $two = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($second)
        $value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($one)
        $confirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($two)
        if ($value.Length -lt 12 -or $value.Length -gt 128) { throw 'Sifre 12-128 karakter arasinda olmali.' }
        if (-not [string]::Equals($value, $confirmation, [StringComparison]::Ordinal)) { throw 'Sifreler ayni degil. Kurulumu tekrar baslatin.' }
        return $value
    } finally {
        if ($one -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($one) }
        if ($two -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($two) }
        $first.Dispose()
        $second.Dispose()
        $confirmation = $null
    }
}
try {
    Write-Host ''
    Write-Host 'KUZMIN - Windows yerel kurulum' -ForegroundColor Green
    Write-Host 'Bu kurulum hesap, alan adi veya yonetici yetkisi istemez.'
    Write-Host 'Ilk kurulum icin internet gerekir. Sonraki acilislarda gerekmez.'
    Write-Host 'KUZMIN sunucusu aciksa once sunucu penceresinde Ctrl+C ile kapatin.'
    Write-Host ''
    if (-not [Environment]::Is64BitOperatingSystem) { throw 'Windows 10/11 64-bit gerekiyor.' }
    if (-not (Test-Path -LiteralPath (Join-Path $root 'package-lock.json'))) { throw 'ZIP dosyasini once Tumunu Ayikla ile normal bir klasore cikartin.' }
    if (-not (Test-Path -LiteralPath $node)) {
        New-Item -ItemType Directory -Path $runtime -Force | Out-Null
        $arch = 'x64'
        if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { $arch = 'arm64' }
        $base = 'https://nodejs.org/dist/latest-v24.x/'
        [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
        Write-Host '1/4 - Resmi Node.js 24 paketi aliniyor...'
        $checksums = (Invoke-WebRequest -UseBasicParsing -Uri ($base + 'SHASUMS256.txt')).Content
        $pattern = '(?m)^([a-fA-F0-9]{64})\s+\*?(node-v24\.\d+\.\d+-win-' + $arch + '\.zip)\s*$'
        $matches = [regex]::Matches([string]$checksums, $pattern)
        if ($matches.Count -ne 1) { throw 'Resmi Node.js paketinin SHA-256 kaydi bulunamadi.' }
        $expected = $matches[0].Groups[1].Value.ToLowerInvariant()
        $filename = $matches[0].Groups[2].Value
        $archive = Join-Path $runtime $filename
        if (-not (Test-Path -LiteralPath $archive)) {
            Invoke-WebRequest -UseBasicParsing -Uri ($base + $filename) -OutFile $archive
        }
        $actual = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($actual -ne $expected) {
            Remove-Item -LiteralPath $archive -Force
            throw 'Indirilen dosyanin SHA-256 dogrulamasi basarisiz. Kurulumu tekrar deneyin.'
        }
        $staging = Join-Path $runtime ('staging-' + [guid]::NewGuid().ToString('N'))
        try {
            Expand-Archive -LiteralPath $archive -DestinationPath $staging
            $extracted = Join-Path $staging ([IO.Path]::GetFileNameWithoutExtension($filename))
            if (-not (Test-Path -LiteralPath (Join-Path $extracted 'node.exe'))) { throw 'Node.js paketi acilamadi.' }
            Move-Item -LiteralPath $extracted -Destination $nodeDir
            @{ version = $filename; sha256 = $expected; source = $base } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $runtime 'node-runtime.json') -Encoding UTF8
        } finally {
            if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
        }
    }
    $version = & $node -v
    if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v24\.') { throw 'Node.js 24 baslatilamadi. .runtime klasorunu kontrol edin.' }
    $env:PATH = $nodeDir + ';' + $env:PATH
    $env:NEXT_TELEMETRY_DISABLED = '1'
    Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
    Write-Host '2/4 - Yerel yonetim hesabi hazirlaniyor...'
    if (-not (Test-Path -LiteralPath (Join-Path $root '.env.local'))) {
        $password = Read-PrivatePassword
        try {
            $info = New-Object Diagnostics.ProcessStartInfo
            $info.FileName = $node
            $info.Arguments = '"' + (Join-Path $root 'scripts\setup-demo.mjs') + '" --password-stdin'
            $info.WorkingDirectory = $root
            $info.UseShellExecute = $false
            $info.RedirectStandardInput = $true
            $info.StandardInputEncoding = New-Object System.Text.UTF8Encoding -ArgumentList $false
            $process = New-Object Diagnostics.Process
            $process.StartInfo = $info
            if (-not $process.Start()) { throw 'Yerel hesap olusturulamadi.' }
            $process.StandardInput.WriteLine($password)
            $process.StandardInput.Close()
            $process.WaitForExit()
            if ($process.ExitCode -ne 0) { throw 'Sifre kaydedilemedi.' }
        } finally { $password = $null }
    } else {
        Write-Host 'Mevcut .env.local ve sifre korunuyor.'
    }
    Write-Host '3/4 - Uygulama bagimliliklari kuruluyor. Bir kac dakika surebilir...'
    $npm = Join-Path $nodeDir 'node_modules\npm\bin\npm-cli.js'
    Invoke-Checked $node @($npm, 'ci', '--include=dev', '--include=optional', '--no-audit', '--no-fund')
    Write-Host '4/4 - Uygulama bilgisayariniz icin hazirlaniyor...'
    Invoke-Checked $node @($npm, 'run', 'build')
    Write-Host ''
    Write-Host 'Kurulum tamamlandi.' -ForegroundColor Green
    Write-Host 'Magaza icin: 2-BASLAT.cmd'
    Write-Host 'Yonetim paneli icin: 3-YONETIM.cmd'
    Write-Host 'E-posta: demo@local.test - Sifre: kurulumda belirlediginiz sifre'
    Write-Host 'Uygulama acikken sunucu penceresini acik birakin.'
    exit 0
} catch {
    Write-Host ''
    Write-Host ('Kurulum durdu: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'Mevcut urunleriniz, fotograflariniz ve sifreniz silinmedi.'
    exit 1
}
