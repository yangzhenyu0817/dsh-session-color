# 用本地 token 发布到 npm(不把 token 写进全局 .npmrc,也不落在 shell 历史里)
#
# 用法:
#   .\publish-npm.ps1 -TokenFile D:\path\to\.npm-token
#   $env:NPM_TOKEN = 'npm_xxx'; .\publish-npm.ps1
#
# token 生成:https://www.npmjs.com/settings/~/tokens → Generate New Token →
#   Classic Token → 勾 Automation(或 Publish)。仅发布用,不要给 Others。
param(
	[string]$TokenFile,
	[string]$Registry = 'https://registry.npmjs.org/'
)

$ErrorActionPreference = 'Stop'
$pkgRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $pkgRoot
try {
	$token = $env:NPM_TOKEN
	if (-not $token -and $TokenFile -and (Test-Path $TokenFile)) {
		$token = (Get-Content -LiteralPath $TokenFile -Raw).Trim()
	}
	if (-not $token) { throw '没有 token:用 -TokenFile 指定文件,或设置 $env:NPM_TOKEN。' }

	$tmpRc = Join-Path ([IO.Path]::GetTempPath()) ("dsh-npmrc-" + [guid]::NewGuid().ToString('N'))
	$cache = Join-Path ([IO.Path]::GetTempPath()) 'dsh-npm-cache'
	try {
		$hostPart = $Registry -replace '^https?:', ''
		Set-Content -LiteralPath $tmpRc -Value ("registry=$Registry`n//$hostPart/:_authToken=$token") -NoNewline -Encoding ascii
		& npm publish --userconfig $tmpRc --cache $cache --registry $Registry
		if ($LASTEXITCODE -ne 0) { throw "npm publish 失败(exit $LASTEXITCODE)" }
	}
	finally {
		Remove-Item -LiteralPath $tmpRc -Force -ErrorAction SilentlyContinue
	}
}
finally {
	Pop-Location
}
