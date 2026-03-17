. (Join-Path $PSScriptRoot 'superpowers-pwsh-common.ps1')

$bashPath = Get-SuperpowersBashPath
$bashScript = Convert-SuperpowersPathToBash -Path (Join-Path $PSScriptRoot 'superpowers-workflow-status')
$output = & $bashPath $bashScript @args
$exitCode = $LASTEXITCODE

if ($exitCode -eq 0 -and $null -ne $output) {
  $outputText = if ($output -is [System.Array]) { ($output -join "`n") } else { [string]$output }
  if (-not [string]::IsNullOrWhiteSpace($outputText) -and $outputText.TrimStart().StartsWith('{')) {
    $outputText = Convert-SuperpowersJsonFieldPathsToWindows -JsonText $outputText -Fields @('root')
  }
  $output = $outputText
}

if ($null -ne $output) {
  $output
}
exit $exitCode
