# CSS Split Script for Ngoaingu3k
# Splits the monolithic styles.css into logical modules

$sourceFile = "c:\Users\admin\Desktop\25tr\Ngoaingu3k\client\src\styles.css"
$outDir = "c:\Users\admin\Desktop\25tr\Ngoaingu3k\client\src\styles"

# Create output directory
New-Item -ItemType Directory -Force -Path $outDir | Out-Null
New-Item -ItemType Directory -Force -Path "$outDir\pages" | Out-Null

$lines = Get-Content $sourceFile

# We'll assign line ranges based on content analysis
# base.css: lines 1-81 (root vars, reset, body, a, button/input)
# layout.css: lines 82-365 (app-shell, topbar, footer, site-frame, nav, buttons, theme)
# components.css: lines 366-475 (page, home-page shared, hero-panel, cards, auth-copy, dashboard-head)
# pages/home.css: lines 476-875 approx (hero, stats, visual grid, slide tabs, content-card, stat-card, pastel)
# pages/courses.css: catalog-*, course-card styles
# pages/course-detail.css: course-hero, price-box, split-layout
# pages/learning.css: learning-layout, lesson-*, exercise styles
# pages/auth.css: auth-layout, auth-card styles  
# pages/dashboard.css: dashboard-* styles
# floating.css: floating-contact, floating-test-button
# Enterprise + HSK campaign sections

Write-Output "Reading $($lines.Count) lines..."

# Helper: find first line matching pattern at or after startLine
function Find-Line($pattern, $startLine) {
    for ($i = $startLine; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match $pattern) { return $i }
    }
    return -1
}

# Identify key section boundaries
$sectionBounds = @{}

# Find major CSS class starts
for ($i = 0; $i -lt $lines.Count; $i++) {
    $line = $lines[$i].Trim()
    
    # Track first occurrence of major sections
    if ($line -match '^\.(app-shell)' -and -not $sectionBounds.ContainsKey('layout')) {
        $sectionBounds['layout'] = $i
    }
    if ($line -match '^\.page\s*\{' -and -not $sectionBounds.ContainsKey('components')) {
        $sectionBounds['components'] = $i
    }
    if ($line -match '^\.(home-page|home-hero)' -and -not $sectionBounds.ContainsKey('home')) {
        $sectionBounds['home'] = $i
    }
    if ($line -match '^\.(catalog-|course-card\s)' -and -not $sectionBounds.ContainsKey('courses')) {
        $sectionBounds['courses'] = $i
    }
    if ($line -match '^\.(course-hero|price-box|split-layout)' -and -not $sectionBounds.ContainsKey('courseDetail')) {
        $sectionBounds['courseDetail'] = $i
    }
    if ($line -match '^\.(learning-layout|learning-|lesson-)' -and -not $sectionBounds.ContainsKey('learning')) {
        $sectionBounds['learning'] = $i
    }
    if ($line -match '^\.(auth-layout|auth-card)' -and -not $sectionBounds.ContainsKey('auth')) {
        $sectionBounds['auth'] = $i
    }
    if ($line -match '^\.(dashboard|admin-)' -and -not $sectionBounds.ContainsKey('dashboard')) {
        $sectionBounds['dashboard'] = $i
    }
    if ($line -match '^\.(floating-)' -and -not $sectionBounds.ContainsKey('floating')) {
        $sectionBounds['floating'] = $i
    }
    if ($line -match '^/\*.*Enterprise' -and -not $sectionBounds.ContainsKey('enterprise')) {
        $sectionBounds['enterprise'] = $i
    }
    if ($line -match '^/\*.*HSK' -and -not $sectionBounds.ContainsKey('hsk')) {
        $sectionBounds['hsk'] = $i
    }
    if ($line -match '^@media' -and -not $sectionBounds.ContainsKey('responsive')) {
        $sectionBounds['responsive'] = $i
    }
}

Write-Output "Found sections:"
$sectionBounds.GetEnumerator() | Sort-Object Value | ForEach-Object { Write-Output "  $($_.Key): line $($_.Value)" }

# Since precise splitting by CSS selectors is complex (selectors can be mixed),
# we'll take a simpler approach: keep base/layout/components separate,
# and group the rest by major comment blocks and known patterns.

# Write base.css (root vars, reset, body)
$baseEnd = $sectionBounds['layout'] - 1
$baseContent = $lines[0..$baseEnd] -join "`n"
Set-Content -Path "$outDir\base.css" -Value $baseContent -NoNewline
Write-Output "base.css: lines 1-$($baseEnd+1)"

# Write layout.css (app-shell through buttons/theme)
$layoutEnd = $sectionBounds['components'] - 1
$layoutContent = $lines[$sectionBounds['layout']..$layoutEnd] -join "`n"
Set-Content -Path "$outDir\layout.css" -Value $layoutContent -NoNewline
Write-Output "layout.css: lines $($sectionBounds['layout']+1)-$($layoutEnd+1)"

# Find where enterprise refresh starts (line 4031)
$enterpriseLine = $sectionBounds['enterprise']
if (-not $enterpriseLine) { $enterpriseLine = 4030 }

# Find where HSK campaign starts (line 5756)  
$hskLine = $sectionBounds['hsk']
if (-not $hskLine) { $hskLine = 5755 }

# Find first @media query
$mediaQueries = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i].Trim() -match '^@media') {
        $mediaQueries += $i
    }
}

# Components + pages: everything from .page to enterprise section
$pagesEnd = $enterpriseLine - 1
$pagesContent = $lines[$sectionBounds['components']..$pagesEnd] -join "`n"
Set-Content -Path "$outDir\components.css" -Value $pagesContent -NoNewline
Write-Output "components.css: lines $($sectionBounds['components']+1)-$($pagesEnd+1)"

# Enterprise UI refresh section
$enterpriseEnd = $hskLine - 1
$enterpriseContent = $lines[$enterpriseLine..$enterpriseEnd] -join "`n"
Set-Content -Path "$outDir\pages\enterprise.css" -Value $enterpriseContent -NoNewline
Write-Output "enterprise.css: lines $($enterpriseLine+1)-$($enterpriseEnd+1)"

# HSK campaign hero section to end
$hskContent = $lines[$hskLine..($lines.Count-1)] -join "`n"
Set-Content -Path "$outDir\pages\hsk-campaign.css" -Value $hskContent -NoNewline
Write-Output "hsk-campaign.css: lines $($hskLine+1)-$($lines.Count)"

Write-Output "`nDone! Created CSS modules in $outDir"
