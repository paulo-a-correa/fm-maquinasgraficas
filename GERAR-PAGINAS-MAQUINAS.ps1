param()

$ErrorActionPreference = "Stop"

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {}

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $Root "config-paginas-maquinas.json"
$OutDir = Join-Path $Root "maquinas"

function Html([object]$Value) {
  if ($null -eq $Value) { return "" }
  return [System.Net.WebUtility]::HtmlEncode([string]$Value)
}

function OneLine([object]$Value) {
  if ($null -eq $Value) { return "" }
  return ([string]$Value -replace "\s+", " ").Trim()
}

function Slug([object]$Value) {
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return "" }

  $normalized = $text.Normalize([Text.NormalizationForm]::FormD)
  $builder = New-Object Text.StringBuilder

  foreach ($char in $normalized.ToCharArray()) {
    $category = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($char)

    if ($category -ne [Globalization.UnicodeCategory]::NonSpacingMark) {
      [void]$builder.Append($char)
    }
  }

  return (
    $builder.ToString().ToLowerInvariant() `
      -replace "[^a-z0-9]+", "-" `
      -replace "^-+|-+$", ""
  )
}

function JoinValues([object[]]$Values, [string]$Separator) {
  $clean = @()

  foreach ($item in $Values) {
    if ($null -ne $item -and -not [string]::IsNullOrWhiteSpace([string]$item)) {
      $clean += [string]$item
    }
  }

  return [string]::Join($Separator, $clean)
}

function EnsureTrailingSlash([string]$Url) {
  $Url = $Url.Trim()
  if (-not $Url.EndsWith("/")) {
    $Url += "/"
  }
  return $Url
}

function DriveFallback([object]$Machine) {
  $url = [string]$Machine.fotoCapaUrl
  if (-not [string]::IsNullOrWhiteSpace($url)) {
    return $url.Trim()
  }

  $id = [string]$Machine.fotoCapaId
  if (-not [string]::IsNullOrWhiteSpace($id)) {
    return "https://drive.google.com/thumbnail?id=$([Uri]::EscapeDataString($id.Trim()))&sz=w1600"
  }

  return ""
}

if (-not (Test-Path $ConfigPath)) {
  throw "Arquivo config-paginas-maquinas.json não encontrado."
}

$config = Get-Content $ConfigPath -Raw -Encoding UTF8 | ConvertFrom-Json

$siteBaseUrl = [string]$config.siteBaseUrl

if (
  [string]::IsNullOrWhiteSpace($siteBaseUrl) -or
  $siteBaseUrl -match "COLE_AQUI"
) {
  Write-Host ""
  Write-Host "PRIMEIRA CONFIGURACAO" -ForegroundColor Cyan
  Write-Host "Digite a URL PUBLICA do site."
  Write-Host "Exemplo: https://www.seudominio.com/"
  Write-Host ""

  $siteBaseUrl = Read-Host "URL do site"

  if (
    [string]::IsNullOrWhiteSpace($siteBaseUrl) -or
    $siteBaseUrl -notmatch "^https?://"
  ) {
    throw "Informe uma URL valida iniciando com http:// ou https://"
  }

  $siteBaseUrl = EnsureTrailingSlash $siteBaseUrl
  $config.siteBaseUrl = $siteBaseUrl

  $config |
    ConvertTo-Json -Depth 5 |
    Set-Content $ConfigPath -Encoding UTF8

  Write-Host "URL salva em config-paginas-maquinas.json." -ForegroundColor Green
} else {
  $siteBaseUrl = EnsureTrailingSlash $siteBaseUrl
}

$api =
  ([string]$config.appsScriptUrl).TrimEnd("/") +
  "?api=1&action=maquinas"

Write-Host ""
Write-Host "Consultando catalogo..." -ForegroundColor Cyan
Write-Host $api
Write-Host ""

$response = Invoke-RestMethod `
  -Uri $api `
  -Method Get `
  -Headers @{ "Accept" = "application/json" }

if (-not $response.success) {
  throw (
    "A API retornou erro: " +
    [string]$response.message
  )
}

$machines = @($response.maquinas)

if (-not (Test-Path $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir | Out-Null
}

# Remove somente HTMLs previamente gerados.
Get-ChildItem $OutDir -Filter "*.html" -File -ErrorAction SilentlyContinue |
  Remove-Item -Force

$generated = 0

foreach ($m in $machines) {
  $slug = OneLine $m.slug

  if ([string]::IsNullOrWhiteSpace($slug)) {
    $slug = Slug (
      JoinValues @(
        $m.marca,
        $m.modelo,
        $m.ano,
        $m.titulo
      ) " "
    )
  }

  if ([string]::IsNullOrWhiteSpace($slug)) {
    $slug = Slug $m.id
  }

  if ([string]::IsNullOrWhiteSpace($slug)) {
    Write-Warning "Maquina sem slug/ID ignorada."
    continue
  }

  $title = OneLine $m.titulo

  if ([string]::IsNullOrWhiteSpace($title)) {
    $title = OneLine (
      @($m.marca, $m.modelo) |
      Where-Object { $_ } |
      ForEach-Object { [string]$_ } |
      Join-String -Separator " "
    )
  }

  if ([string]::IsNullOrWhiteSpace($title)) {
    $title = "Equipamento"
  }

  $description = OneLine $m.descricaoCurta

  if ([string]::IsNullOrWhiteSpace($description)) {
    $description = OneLine $m.descricaoCompleta
  }

  if ([string]::IsNullOrWhiteSpace($description)) {
    $description = OneLine (
      JoinValues @(
        $m.marca,
        $m.modelo,
        $m.ano,
        $m.categoria,
        $m.localizacao
      ) " • "
    )
  }

  if ([string]::IsNullOrWhiteSpace($description)) {
    $description = "Confira este equipamento na Felipe Mariano Máquinas Graficas."
  }

  if ($description.Length -gt 220) {
    $description = $description.Substring(0, 217).Trim() + "..."
  }

  $pageUrl =
    $siteBaseUrl +
    "maquinas/" +
    [Uri]::EscapeDataString($slug) +
    ".html"

  $imageUrl = DriveFallback $m

  if ([string]::IsNullOrWhiteSpace($imageUrl)) {
    $imageUrl =
      $siteBaseUrl +
      "assets/logo-fm-maquinas-graficas.webp"
  }

  $facts = New-Object System.Collections.Generic.List[string]

  $factPairs = @(
    @("Marca", $m.marca),
    @("Modelo", $m.modelo),
    @("Ano", $m.ano),
    @("Localizacao", $m.localizacao),
    @("Disponibilidade", $m.disponibilidade)
  )

  foreach ($pair in $factPairs) {
    $value = OneLine $pair[1]

    if (-not [string]::IsNullOrWhiteSpace($value)) {
      $facts.Add(@"
        <div class="machine-page-fact">
          <span>$(Html $pair[0])</span>
          <strong>$(Html $value)</strong>
        </div>
"@)
    }
  }

  $specRows = New-Object System.Collections.Generic.List[string]

  foreach ($spec in @($m.especificacoes)) {
    $name = OneLine $spec.nome
    $value = OneLine $spec.valor

    if (
      [string]::IsNullOrWhiteSpace($name) -and
      [string]::IsNullOrWhiteSpace($value)
    ) {
      continue
    }

    $specRows.Add(@"
        <div class="machine-page-spec">
          <dt>$(Html $name)</dt>
          <dd>$(Html $value)</dd>
        </div>
"@)
  }

  $photos = New-Object System.Collections.Generic.List[object]

  foreach ($photo in @($m.fotos)) {
    $photoUrl = OneLine $photo.url

    if (
      [string]::IsNullOrWhiteSpace($photoUrl) -and
      -not [string]::IsNullOrWhiteSpace([string]$photo.arquivoId)
    ) {
      $photoUrl =
        "https://drive.google.com/thumbnail?id=" +
        [Uri]::EscapeDataString([string]$photo.arquivoId) +
        "&sz=w1600"
    }

    if (-not [string]::IsNullOrWhiteSpace($photoUrl)) {
      $photos.Add(
        [PSCustomObject]@{
          url = $photoUrl
          capa = [bool]$photo.capa
        }
      )
    }
  }

  if ($photos.Count -eq 0 -and -not [string]::IsNullOrWhiteSpace($imageUrl)) {
    $photos.Add(
      [PSCustomObject]@{
        url = $imageUrl
        capa = $true
      }
    )
  }

  $mainImage = $imageUrl

  if ($photos.Count -gt 0) {
    $cover = $photos | Where-Object { $_.capa } | Select-Object -First 1

    if ($null -ne $cover) {
      $mainImage = $cover.url
    } else {
      $mainImage = $photos[0].url
    }
  }

  $thumbs = New-Object System.Collections.Generic.List[string]

  for ($i = 0; $i -lt $photos.Count; $i++) {
    $p = $photos[$i]
    $active = if ($i -eq 0) { " is-active" } else { "" }

    $thumbs.Add(@"
          <button
            class="machine-page-thumb$active"
            type="button"
            data-src="$(Html $p.url)"
            data-alt="$(Html $title)"
            aria-label="Ver foto $($i + 1)"
          >
            <img src="$(Html $p.url)" alt="">
          </button>
"@)
  }

  $priceHtml = ""

  if ($m.mostrarPreco -and -not [string]::IsNullOrWhiteSpace([string]$m.preco)) {
    $priceHtml =
      '<div class="machine-page-price">' +
      (Html $m.preco) +
      '</div>'
  }

  $specHtml = ""

  if ($specRows.Count -gt 0) {
    $specHtml = @"
        <section class="machine-page-specs-wrap">
          <h2>Especificacoes tecnicas</h2>
          <dl class="machine-page-specs">
$($specRows -join "`n")
          </dl>
        </section>
"@
  }

  $whatsMessage = @(
    "Ola! Vim pelo site da Felipe Mariano Maquinas Graficas.",
    "",
    "Gostaria de mais informacoes sobre este equipamento:",
    "",
    "Maquina: $title"
  )

  if ($m.marca) { $whatsMessage += "Marca: $($m.marca)" }
  if ($m.modelo) { $whatsMessage += "Modelo: $($m.modelo)" }
  if ($m.ano) { $whatsMessage += "Ano: $($m.ano)" }
  if ($m.localizacao) { $whatsMessage += "Localizacao: $($m.localizacao)" }
  $whatsMessage += ""
  $whatsMessage += $pageUrl

  $whatsUrl =
    "https://wa.me/" +
    ([string]$config.whatsappNumber -replace "\D", "") +
    "?text=" +
    [Uri]::EscapeDataString(($whatsMessage -join "`n"))

  $fullTitle = "$title | $($config.siteName)"

  # ----------------------------------------------------------
  # Valores preparados ANTES do here-string.
  # Compatível com Windows PowerShell 5.1.
  # ----------------------------------------------------------

  $fullDescription = [string]$m.descricaoCompleta

  if ([string]::IsNullOrWhiteSpace($fullDescription)) {
    $fullDescription = $description
  }

  $thumbsHtml = ""

  if ($thumbs.Count -gt 1) {
    $thumbsHtml =
      '<div class="machine-page-thumbs">' +
      ($thumbs -join "`n") +
      '</div>'
  }

  $categoryChipHtml = ""

  if (-not [string]::IsNullOrWhiteSpace([string]$m.categoria)) {
    $categoryChipHtml =
      '<span class="machine-page-chip">' +
      (Html $m.categoria) +
      '</span>'
  }

  $conditionChipHtml = ""

  if (-not [string]::IsNullOrWhiteSpace([string]$m.condicao)) {
    $conditionChipHtml =
      '<span class="machine-page-chip">' +
      (Html $m.condicao) +
      '</span>'
  }

  $html = @"
<!DOCTYPE html>
<html lang="pt-BR" data-theme="light">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>$(Html $fullTitle)</title>
  <meta name="description" content="$(Html $description)">
  <meta name="theme-color" content="#f3f1ef">

  <link rel="canonical" href="$(Html $pageUrl)">

  <!-- OPEN GRAPH: WhatsApp, Facebook, LinkedIn etc. -->
  <meta property="og:locale" content="pt_BR">
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="$(Html $config.siteName)">
  <meta property="og:title" content="$(Html $fullTitle)">
  <meta property="og:description" content="$(Html $description)">
  <meta property="og:url" content="$(Html $pageUrl)">
  <meta property="og:image" content="$(Html $imageUrl)">
  <meta property="og:image:secure_url" content="$(Html $imageUrl)">
  <meta property="og:image:alt" content="$(Html $title)">

  <!-- X / Twitter -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="$(Html $fullTitle)">
  <meta name="twitter:description" content="$(Html $description)">
  <meta name="twitter:image" content="$(Html $imageUrl)">

  <link rel="icon" type="image/png" href="../assets/logo-fm-maquinas-graficas.webp">
  <link rel="stylesheet" href="../style.css">
  <link rel="stylesheet" href="../maquinas.css">
</head>

<body class="machine-page-body">

  <header class="machine-page-header">
    <div class="container machine-page-header-inner">
      <a class="machine-page-brand" href="../index.html#topo" aria-label="Felipe Mariano - inicio">
        <img
          src="../assets/logo-fm-maquinas-graficas.webp"
          alt="Felipe Mariano - Maquinas Graficas"
        >
      </a>

      <div class="header-actions">
        <button
          class="theme-toggle"
          id="machinePageThemeToggle"
          type="button"
          aria-label="Alternar tema"
          title="Alternar tema"
        >☾</button>

        <a class="btn btn-ghost machine-page-back" href="../index.html#maquinas">
          Voltar ao catalogo
        </a>
      </div>
    </div>
  </header>

  <main class="machine-page-main">
    <div class="container machine-page-grid">

      <section class="machine-page-gallery" aria-label="Fotos do equipamento">
        <div class="machine-page-main-image">
          <img
            id="machinePageMainImage"
            src="$(Html $mainImage)"
            alt="$(Html $title)"
          >
        </div>

        $thumbsHtml
      </section>

      <article class="machine-page-content">
        <div class="machine-page-topline">
          $categoryChipHtml
          $conditionChipHtml
        </div>

        <h1>$(Html $title)</h1>

        <p class="machine-page-description">
          $(Html $fullDescription)
        </p>

        <div class="machine-page-facts">
$($facts -join "`n")
        </div>

$specHtml

$priceHtml

        <div class="machine-page-actions">
          <a
            class="btn btn-primary btn-lg"
            href="$(Html $whatsUrl)"
          >
            Falar sobre esta maquina no WhatsApp ↗
          </a>

          <button
            class="btn btn-ghost btn-lg"
            id="machinePageShare"
            type="button"
          >
            Compartilhar equipamento ↗
          </button>

          <div
            class="machine-page-share-status"
            id="machinePageShareStatus"
            aria-live="polite"
          ></div>
        </div>
      </article>

    </div>
  </main>

  <footer class="machine-page-footer">
    <div class="container">
      Felipe Mariano Maquinas Graficas
    </div>
  </footer>

  <script src="../maquinas.js"></script>
</body>
</html>
"@

  $filePath =
    Join-Path $OutDir ($slug + ".html")

  [IO.File]::WriteAllText(
    $filePath,
    $html,
    (New-Object Text.UTF8Encoding($false))
  )

  $generated += 1

  Write-Host (
    "[OK] " +
    $slug +
    ".html"
  ) -ForegroundColor Green
}

Write-Host ""
Write-Host "Concluido." -ForegroundColor Cyan
Write-Host "$generated pagina(s) gerada(s) em:"
Write-Host $OutDir
Write-Host ""
Write-Host "Agora publique a pasta 'maquinas' junto com o site."
