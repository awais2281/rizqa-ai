# PowerShell script to verify AAB signing certificate SHA1
# Usage: .\verify-aab.ps1 your-app.aab

param(
    [Parameter(Mandatory=$true)]
    [string]$AabFile
)

if (-not (Test-Path $AabFile)) {
    Write-Host "Error: AAB file not found: $AabFile" -ForegroundColor Red
    exit 1
}

Write-Host "Verifying AAB: $AabFile" -ForegroundColor Cyan
Write-Host ""

# Expected SHA1
$ExpectedSHA1 = "04:8A:AB:0D:BA:1F:2B:E9:7D:9E:F4:63:FB:40:77:B2:50:D6:00:E6"

# Method 1: Try using jarsigner (if Java is installed)
$javaPath = Get-Command java -ErrorAction SilentlyContinue
if ($javaPath) {
    Write-Host "Method 1: Using jarsigner..." -ForegroundColor Yellow
    
    # Create temp directory
    $tempDir = Join-Path $env:TEMP "aab-verify-$(Get-Random)"
    New-Item -ItemType Directory -Path $tempDir -Force | Out-Null
    
    try {
        # Extract AAB (it's a ZIP file)
        Expand-Archive -Path $AabFile -DestinationPath $tempDir -Force
        
        # Check for signing files
        $metaInfPath = Join-Path $tempDir "META-INF"
        if (Test-Path $metaInfPath) {
            $rsaFiles = Get-ChildItem -Path $metaInfPath -Filter "*.RSA" -ErrorAction SilentlyContinue
            $dsaFiles = Get-ChildItem -Path $metaInfPath -Filter "*.DSA" -ErrorAction SilentlyContinue
            $ecFiles = Get-ChildItem -Path $metaInfPath -Filter "*.EC" -ErrorAction SilentlyContinue
            
            $certFiles = $rsaFiles + $dsaFiles + $ecFiles
            
            if ($certFiles.Count -gt 0) {
                Write-Host "Found certificate files in META-INF" -ForegroundColor Green
                
                # Try to extract certificate info using keytool or openssl
                foreach ($certFile in $certFiles) {
                    Write-Host "`nCertificate: $($certFile.Name)" -ForegroundColor Cyan
                    
                    # Try keytool first
                    $keytoolPath = Get-Command keytool -ErrorAction SilentlyContinue
                    if ($keytoolPath) {
                        $keytoolOutput = & keytool -printcert -file $certFile.FullName 2>&1
                        $sha1Line = $keytoolOutput | Select-String "SHA1:"
                        if ($sha1Line) {
                            Write-Host $sha1Line -ForegroundColor White
                            $foundSHA1 = ($sha1Line -split "SHA1:")[1].Trim()
                            if ($foundSHA1 -eq $ExpectedSHA1) {
                                Write-Host "`n✅ SHA1 MATCHES EXPECTED VALUE!" -ForegroundColor Green
                            } else {
                                Write-Host "`n❌ SHA1 DOES NOT MATCH!" -ForegroundColor Red
                                Write-Host "Expected: $ExpectedSHA1" -ForegroundColor Yellow
                                Write-Host "Found:    $foundSHA1" -ForegroundColor Yellow
                            }
                        }
                    } else {
                        Write-Host "keytool not found. Install Java JDK to use this method." -ForegroundColor Yellow
                    }
                }
            } else {
                Write-Host "No certificate files found in META-INF" -ForegroundColor Yellow
            }
        }
    } finally {
        # Cleanup
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
} else {
    Write-Host "Java not found. Please install Java JDK to verify AAB signatures." -ForegroundColor Yellow
}

Write-Host "`n" -NoNewline
Write-Host "Expected SHA1: " -NoNewline -ForegroundColor Cyan
Write-Host $ExpectedSHA1 -ForegroundColor White
Write-Host "`nNote: For best results, use bundletool to extract APK from AAB, then use apksigner:" -ForegroundColor Yellow
Write-Host "  java -jar bundletool.jar build-apks --bundle=your-app.aab --output=app.apks --mode=universal" -ForegroundColor Gray
Write-Host "  unzip app.apks universal.apk" -ForegroundColor Gray
Write-Host "  apksigner verify --print-certs universal.apk" -ForegroundColor Gray

