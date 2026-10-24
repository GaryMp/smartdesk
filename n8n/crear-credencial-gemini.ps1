$ErrorActionPreference = 'Stop'

$secureKey = Read-Host 'Pega tu API key de Gemini (entrada oculta)' -AsSecureString
$ptr = [IntPtr]::Zero
$tempFile = Join-Path $env:TEMP 'n8n-gemini-credential-temp.json'

try {
    $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secureKey)
    $apiKey = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)

    $credential = @(
        @{
            name = 'Gemini - SmartDesk'
            type = 'googlePalmApi'
            data = @{
                host = 'https://generativelanguage.googleapis.com'
                apiKey = $apiKey
            }
        }
    )

    $json = ConvertTo-Json -InputObject $credential -Depth 5
    [IO.File]::WriteAllText(
        $tempFile,
        $json,
        [Text.UTF8Encoding]::new($false)
    )

    Remove-Variable apiKey -ErrorAction SilentlyContinue
    Write-Host 'Archivo temporal preparado. Se importará en n8n.'
    & npx.cmd --yes n8n@2.44.5 import:credentials "--input=$tempFile"

    if ($LASTEXITCODE -ne 0) {
        throw 'n8n no pudo importar la credencial.'
    }

    Write-Host 'Importación completada.'
}
finally {
    if ($ptr -ne [IntPtr]::Zero) {
        [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
    if ($secureKey) { $secureKey.Dispose() }
    Remove-Item $tempFile -Force -ErrorAction SilentlyContinue
    Remove-Variable apiKey, json, credential -ErrorAction SilentlyContinue
}
